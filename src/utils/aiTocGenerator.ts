/**
 * AI-powered TOC generation using SiliconFlow Vision API.
 *
 * Strategy:
 * 1. Render PDF pages as JPEG images
 * 2. Send each page to the vision model (Qwen2.5-VL) -- up to CONCURRENCY pages in parallel
 * 3. Ask the AI to identify TOC pages and extract entries
 * 4. Stop when AI indicates TOC section has ended or max pages reached
 * 5. Parse responses into TocItem[] structure
 */

import { renderPageToBase64 } from "./pdfRenderer";
import type { TocItem } from "../types/toc";
import { generateTocId } from "../types/toc";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PDFDocumentProxy = any;

export interface AiTocConfig {
  apiKey: string;
  baseUrl: string;  // e.g. "https://api.siliconflow.cn/v1"
  model: string;    // e.g. "Qwen/Qwen2.5-VL-72B-Instruct"
}

/** Status reported during generation */
export interface AiTocProgress {
  status: "rendering" | "analyzing" | "parsing" | "done" | "error";
  message: string;
  currentPage?: number;
  totalEntries?: number;
}

/** Raw entry extracted by the AI */
interface RawTocEntry {
  title: string;
  page: number;
  printed_page: string; // The literal string shown in the TOC (e.g. "iv", "24")
  level: number; // 0 = top-level, 1 = section, 2 = subsection, etc.
}

/** AI response schema for a single page */
interface AiPageResponse {
  is_toc_page: boolean;
  entries: RawTocEntry[];
  is_toc_complete: boolean;
}

// Maximum pages to scan before giving up
const MAX_SCAN_PAGES = 30;

// Number of parallel API calls
const CONCURRENCY = 3;

// System prompt for the vision model
const SYSTEM_PROMPT = `You are a precise document analyzer. Your task is to examine a PDF page image and identify if it is a Table of Contents (TOC) page.

When you see a TOC page, extract ALL entries with their exact titles, page numbers, and hierarchy levels.

Respond ONLY with a JSON object in this exact format:
{
  "is_toc_page": true,
  "entries": [
    {"title": "Chapter 1 Introduction", "page": 1, "printed_page": "1", "level": 0},
    {"title": "Preface", "page": 5, "printed_page": "v", "level": 1},
    {"title": "1.1.1 History", "page": 7, "printed_page": "7", "level": 2}
  ],
  "is_toc_complete": true
}

Rules:
- level 0 = top-level chapter/part, level 1 = section, level 2 = subsection, etc.
- "is_toc_complete" should be true if this page seems to be the LAST page of the TOC (the next page would be actual content)
- If the page is NOT a TOC page (title page, preface, content, etc.), set "is_toc_page" to false and "entries" to []
- Extract page numbers exactly as printed in the TOC.
- "printed_page" is the literal string value of the page number as printed on the TOC (e.g., "1", "12", "i", "xiv").
- "page" is the numeric form of the printed page. Do your best to parse roman numerals into numbers for this field. (e.g. "iv" -> 4).
- Do NOT include decorative text, headers, or footers - only actual TOC entries.
- Respond with ONLY the JSON object. No markdown, no explanation.`;

/**
 * Call SiliconFlow Vision API with a single page image.
 */
async function callVisionApi(
  config: AiTocConfig,
  imageDataUrl: string,
  pageNumber: number,
  signal?: AbortSignal,
): Promise<AiPageResponse> {
  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: imageDataUrl,
                detail: "high",
              },
            },
            {
              type: "text",
              text: `This is page ${pageNumber} of the PDF. Analyze it and respond with JSON only.`,
            },
          ],
        },
      ],
      temperature: 0.1,
      max_tokens: 4096,
    }),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("Empty response from API");
  }

  return parseAiResponse(content);
}

/**
 * Parse the AI response string into AiPageResponse.
 * Handles cases where the AI wraps JSON in markdown code fences.
 */
function parseAiResponse(content: string): AiPageResponse {
  let jsonStr = content.trim();
  if (jsonStr.startsWith("```")) {
    jsonStr = jsonStr.replace(/^```\w*\n?/, "");
    jsonStr = jsonStr.replace(/\n?```$/, "");
  }

  try {
    const parsed = JSON.parse(jsonStr);

    return {
      is_toc_page: Boolean(parsed.is_toc_page),
      entries: Array.isArray(parsed.entries)
        ? parsed.entries.map((e: Record<string, unknown>) => ({
            title: String(e.title || "").trim(),
            page: Number(e.page) || 0,
            printed_page: String(e.printed_page || "").trim(),
            level: Number(e.level) || 0,
          }))
        : [],
      is_toc_complete: Boolean(parsed.is_toc_complete),
    };
  } catch {
    console.error("Failed to parse AI response:", content);
    return {
      is_toc_page: false,
      entries: [],
      is_toc_complete: false,
    };
  }
}

/**
 * Process a single page: render + call API.
 * Returns the result with the page number attached.
 */
async function processPage(
  pdf: PDFDocumentProxy,
  config: AiTocConfig,
  pageNumber: number,
  signal?: AbortSignal,
): Promise<{ pageNumber: number; result: AiPageResponse }> {
  const imageDataUrl = await renderPageToBase64(pdf, pageNumber, 1.0);
  const result = await callVisionApi(config, imageDataUrl, pageNumber, signal);
  return { pageNumber, result };
}

/**
 * Convert flat list of RawTocEntry into nested TocItem[] tree.
 */
function buildTocTree(entries: RawTocEntry[]): TocItem[] {
  if (entries.length === 0) return [];

  const root: TocItem[] = [];
  const stack: { items: TocItem[]; depth: number }[] = [
    { items: root, depth: -1 },
  ];

  for (const entry of entries) {
    const newItem: TocItem = {
      id: generateTocId(),
      title: entry.title,
      pageNumber: entry.page,
      depth: entry.level,
      children: [],
    };

    while (stack.length > 1 && stack[stack.length - 1].depth >= entry.level) {
      stack.pop();
    }

    const parent = stack[stack.length - 1];
    parent.items.push(newItem);
    stack.push({ items: newItem.children, depth: entry.level });
  }

  return root;
}

/**
 * Main entry point: auto-generate TOC using AI vision.
 *
 * Uses parallel API calls (CONCURRENCY pages at a time) for speed,
 * while maintaining sequential page ordering for correct TOC assembly.
 */
export async function aiGenerateToc(
  pdf: PDFDocumentProxy,
  config: AiTocConfig,
  onProgress?: (progress: AiTocProgress) => void,
  signal?: AbortSignal,
): Promise<TocItem[]> {
  const numPages = pdf.numPages;
  const maxPages = Math.min(numPages, MAX_SCAN_PAGES);
  const allEntries: RawTocEntry[] = [];

  let foundTocStart = false;
  let consecutiveNonToc = 0;
  let lastTocPdfPage = 0;

  // Process pages in parallel batches, but evaluate results in order
  for (let batchStart = 1; batchStart <= maxPages; batchStart += CONCURRENCY) {
    if (signal?.aborted) {
      break;
    }

    const batchEnd = Math.min(batchStart + CONCURRENCY - 1, maxPages);
    const pageNumbers: number[] = [];
    for (let p = batchStart; p <= batchEnd; p++) {
      pageNumbers.push(p);
    }

    // Progress: starting batch
    onProgress?.({
      status: "analyzing",
      message: `Analyzing pages ${batchStart}-${batchEnd} of ${maxPages}...${allEntries.length > 0 ? ` (${allEntries.length} entries found)` : ""}`,
      currentPage: batchStart,
      totalEntries: allEntries.length,
    });

    // Launch all pages in this batch in parallel, report as each completes
    const settled: { pageNumber: number; result: AiPageResponse }[] = [];
    const promises = pageNumbers.map(p =>
      processPage(pdf, config, p, signal)
        .then(res => {
          settled.push(res);
          // Real-time per-page progress as each API call returns
          const tag = res.result.is_toc_page
            ? `Page ${p}: found ${res.result.entries.length} entries`
            : `Page ${p}: not a TOC page`;
          onProgress?.({
            status: "analyzing",
            message: `${tag}${allEntries.length > 0 ? ` (${allEntries.length} total so far)` : ""}`,
            currentPage: p,
            totalEntries: allEntries.length,
          });
          return res;
        })
        .catch(err => {
          console.error(`Error processing page ${p}:`, err);
          const fallback = {
            pageNumber: p,
            result: { is_toc_page: false, entries: [], is_toc_complete: false } as AiPageResponse,
          };
          settled.push(fallback);
          onProgress?.({
            status: "analyzing",
            message: `Page ${p}: error, skipping...`,
            currentPage: p,
            totalEntries: allEntries.length,
          });
          return fallback;
        })
    );

    const results = await Promise.all(promises);

    // Sort by page number to maintain order
    results.sort((a, b) => a.pageNumber - b.pageNumber);

    // Evaluate results in order
    let shouldStop = false;
    for (const { pageNumber, result } of results) {
      console.log(
        `Page ${pageNumber}: is_toc=${result.is_toc_page}, entries=${result.entries.length}, complete=${result.is_toc_complete}`
      );

      if (result.is_toc_page && result.entries.length > 0) {
        foundTocStart = true;
        consecutiveNonToc = 0;
        lastTocPdfPage = Math.max(lastTocPdfPage, pageNumber);
        allEntries.push(...result.entries);

        // Update progress with details
        onProgress?.({
          status: "analyzing",
          message: `Page ${pageNumber}: +${result.entries.length} entries (total: ${allEntries.length})`,
          currentPage: pageNumber,
          totalEntries: allEntries.length,
        });

        if (result.is_toc_complete) {
          onProgress?.({
            status: "analyzing",
            message: `TOC complete at page ${pageNumber}. Total: ${allEntries.length} entries.`,
            currentPage: pageNumber,
            totalEntries: allEntries.length,
          });
          shouldStop = true;
          break;
        }
      } else {
        consecutiveNonToc++;

        // After finding TOC, stop if we hit 2 consecutive non-TOC pages
        if (foundTocStart && consecutiveNonToc >= 2) {
          onProgress?.({
            status: "analyzing",
            message: `TOC section ended. Total: ${allEntries.length} entries.`,
            currentPage: pageNumber,
            totalEntries: allEntries.length,
          });
          shouldStop = true;
          break;
        }

        // Show what's happening even for non-TOC pages
        onProgress?.({
          status: "analyzing",
          message: `Page ${pageNumber}: not a TOC page. Scanning...`,
          currentPage: pageNumber,
          totalEntries: allEntries.length,
        });
      }
    }

    if (shouldStop) break;
  }

  let pageLabels: string[] | null = null;
  try {
    pageLabels = await pdf.getPageLabels();
    if (pageLabels && pageLabels.length > 0) {
      console.log(`Loaded PDF page labels for exact page mapping`);
    } else {
      console.log(`No PDF page labels found, will use raw extracted page numbers`);
    }
  } catch (err) {
    console.warn("Failed to read page labels:", err);
  }

  // Handle results
  if (allEntries.length === 0) {
    onProgress?.({
      status: "error",
      message: `No TOC found after scanning ${maxPages} pages.`,
    });
    return [];
  }

  // Build tree
  onProgress?.({
    status: "parsing",
    message: `Building TOC tree from ${allEntries.length} entries...`,
    totalEntries: allEntries.length,
  });

  // Check if labels are dummy [1, 2, 3...] which means they are useless 
  const isDummyLabels = pageLabels && pageLabels.length >= 2 && pageLabels[0] === "1" && pageLabels[1] === "2";
  const validLabels = (!isDummyLabels && pageLabels && pageLabels.length > 0) ? pageLabels : null;

  let offsetApplied = false;
  if (validLabels) {
    for (const entry of allEntries) {
      if (entry.printed_page) {
        const labelStr = String(entry.printed_page).trim().toLowerCase();
        const pdfIndex = validLabels.findIndex(l => l.toLowerCase() === labelStr);
        if (pdfIndex >= 0) {
          entry.page = pdfIndex + 1; // 1-indexed PDF page
          offsetApplied = true;
        }
      }
    }
  }

  // If no valid labels, attempt heuristic text search to find main content offset
  if (!offsetApplied && allEntries.length > 0 && lastTocPdfPage > 0) {
    onProgress?.({
      status: "parsing",
      message: `Aligning pages via text search...`,
      totalEntries: allEntries.length,
    });

    try {
      // Find good candidates: Arabic page > 0 and reasonable title
      const candidates = allEntries
        .filter(e => e.page > 0 && e.title.length > 5 && !isNaN(Number(e.printed_page)))
        .slice(0, 3);
        
      let foundOffset: number | null = null;

      for (const candidate of candidates) {
        const cleanTitle = candidate.title.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
        if (cleanTitle.length < 5) continue; 
        
        // Scan PDF pages after TOC where this entry might be
        const startPdfPage = Math.max(lastTocPdfPage + 1, candidate.page);
        const endPdfPage = Math.min(numPages, Math.max(startPdfPage + 20, candidate.page + 50));
        
        for (let p = startPdfPage; p <= endPdfPage; p++) {
          const pdfPage = await pdf.getPage(p);
          const textContent: any = await pdfPage.getTextContent();
          const pageText = (textContent.items || []).map((it: any) => it.str || "").join("").replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
          
          if (pageText.includes(cleanTitle)) {
            foundOffset = p - candidate.page;
            break;
          }
        }
        if (foundOffset !== null) break;
      }

      // Fallback: assume printed page 1 starts exactly after the last TOC page
      if (foundOffset === null) {
        const firstArabic = allEntries.find(e => e.page === 1);
        if (firstArabic) {
           foundOffset = lastTocPdfPage; // offset = lastTocPdfPage + 1(start) - 1(page number)
        } 
      }

      if (foundOffset !== null && foundOffset !== 0) {
        console.log(`Heuristically found global offset: ${foundOffset}`);
        for (const entry of allEntries) {
          if (entry.page > 0) {
             entry.page = Math.max(1, Math.min(numPages, entry.page + foundOffset));
          }
        }
        offsetApplied = true;
      }
    } catch (err) {
      console.warn("Failed heuristic text offset alignment:", err);
    }
  }

  if (offsetApplied) {
    onProgress?.({
      status: "parsing",
      message: `Successfully mapped pages using PDF logical labels.`,
      totalEntries: allEntries.length,
    });
  }

  const tocTree = buildTocTree(allEntries);

  onProgress?.({
    status: "done",
    message: `Done! Generated ${allEntries.length} TOC entries.`,
    totalEntries: allEntries.length,
  });

  return tocTree;
}

/**
 * Load saved AI config from localStorage.
 */
export function loadAiConfig(): Partial<AiTocConfig> {
  try {
    const saved = localStorage.getItem("ai_toc_config");
    if (saved) {
      return JSON.parse(saved);
    }
  } catch {
    // Ignore parse errors
  }
  return {};
}

/**
 * Save AI config to localStorage.
 */
export function saveAiConfig(config: Partial<AiTocConfig>): void {
  localStorage.setItem("ai_toc_config", JSON.stringify(config));
}

/**
 * Get a complete config with defaults filled in.
 */
export function getFullConfig(partial: Partial<AiTocConfig>): AiTocConfig | null {
  if (!partial.apiKey) return null;
  return {
    apiKey: partial.apiKey,
    baseUrl: partial.baseUrl || "https://api.siliconflow.cn/v1",
    model: partial.model || "Qwen/Qwen2.5-VL-72B-Instruct",
  };
}
