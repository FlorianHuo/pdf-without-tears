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
  level: number; // 0 = top-level, 1 = section, 2 = subsection, etc.
}

/** AI response schema for a single page */
interface AiPageResponse {
  is_toc_page: boolean;
  entries: RawTocEntry[];
  is_toc_complete: boolean;
  page_offset: number;
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
    {"title": "Chapter 1 Introduction", "page": 1, "level": 0},
    {"title": "1.1 Background", "page": 5, "level": 1},
    {"title": "1.1.1 History", "page": 7, "level": 2}
  ],
  "page_offset": 14,
  "is_toc_complete": true
}

Rules:
- level 0 = top-level chapter/part, level 1 = section, level 2 = subsection, etc.
- "is_toc_complete" should be true if this page seems to be the LAST page of the TOC (the next page would be actual content)
- If the page is NOT a TOC page (title page, preface, content, etc.), set "is_toc_page" to false and "entries" to []
- Extract page numbers exactly as printed in the TOC.
- "page_offset": I will tell you the PDF page number of this image. Compare it with the printed page number shown on this page (usually at the top or bottom). The offset = (PDF page number) - (printed page number on this page). For example, if I say this is PDF page 15 and the printed page number shown on this page is "xi" (11 in roman) or "1", the offset would be 15 - 1 = 14. If you cannot determine the offset, set it to 0.
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
            level: Number(e.level) || 0,
          }))
        : [],
      is_toc_complete: Boolean(parsed.is_toc_complete),
      page_offset: Number(parsed.page_offset) || 0,
    };
  } catch {
    console.error("Failed to parse AI response:", content);
    return {
      is_toc_page: false,
      entries: [],
      is_toc_complete: false,
      page_offset: 0,
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
  let detectedOffset = 0; // Page offset reported by AI

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
            result: { is_toc_page: false, entries: [], is_toc_complete: false, page_offset: 0 } as AiPageResponse,
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
        // Capture page offset from the first TOC page only
        if (detectedOffset === 0 && result.page_offset !== 0) {
          detectedOffset = result.page_offset;
        }
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

  // Apply page offset from AI
  // The AI reports page_offset on the first TOC page it finds.
  // We use the first non-zero offset reported.
  if (detectedOffset !== 0) {
    console.log(`Applying AI-detected page offset: +${detectedOffset}`);
    onProgress?.({
      status: "parsing",
      message: `Applying page offset: +${detectedOffset}`,
      totalEntries: allEntries.length,
    });
    for (const entry of allEntries) {
      entry.page += detectedOffset;
    }
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
