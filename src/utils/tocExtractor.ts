/**
 * Extract the outline (TOC) from a PDF document loaded by pdf.js.
 * Converts the pdf.js outline tree into our flat-friendly TocItem[] tree.
 */
import type { TocItem } from "../types/toc";
import { generateTocId } from "../types/toc";

interface PdfJsOutlineItem {
  title: string;
  dest: string | unknown[] | null;
  items: PdfJsOutlineItem[];
  bold?: boolean;
  italic?: boolean;
}

// PDFDocumentProxy from pdfjs-dist
interface PdfDocumentProxy {
  getOutline(): Promise<PdfJsOutlineItem[] | null>;
  getDestination(dest: string): Promise<unknown[] | null>;
  getPageIndex(ref: unknown): Promise<number>;
}

/**
 * Resolve a pdf.js destination to a 1-indexed page number.
 */
async function resolveDestToPageNumber(
  pdf: PdfDocumentProxy,
  dest: string | unknown[] | null,
): Promise<number> {
  try {
    if (!dest) return 1;

    let resolved: unknown[] | null;
    if (typeof dest === "string") {
      resolved = await pdf.getDestination(dest);
    } else if (Array.isArray(dest)) {
      resolved = dest;
    } else {
      return 1;
    }

    if (!resolved || resolved.length === 0) return 1;

    // First element is the page reference object {num, gen}
    const rawRef = resolved[0] as Record<string, unknown>;

    // Ensure the ref has the expected shape for getPageIndex
    // (pdf.js worker serialization may alter the object prototype)
    if (
      rawRef &&
      typeof rawRef === "object" &&
      "num" in rawRef &&
      "gen" in rawRef
    ) {
      const ref = { num: Number(rawRef.num), gen: Number(rawRef.gen) };
      const pageIndex = await pdf.getPageIndex(ref);
      return pageIndex + 1;
    }

    return 1;
  } catch {
    return 1;
  }
}

/**
 * Recursively convert pdf.js outline items to our TocItem format.
 */
async function convertOutlineItems(
  pdf: PdfDocumentProxy,
  items: PdfJsOutlineItem[],
  depth: number,
): Promise<TocItem[]> {
  const result: TocItem[] = [];

  for (const item of items) {
    const pageNumber = await resolveDestToPageNumber(pdf, item.dest);
    const children =
      item.items && item.items.length > 0
        ? await convertOutlineItems(pdf, item.items, depth + 1)
        : [];

    result.push({
      id: generateTocId(),
      title: item.title || "(Untitled)",
      pageNumber,
      depth,
      children,
      collapsed: depth >= 2,
    });
  }

  return result;
}

/**
 * Extract the full TOC tree from a pdf.js document.
 * Returns an empty array if no outline exists.
 */
export async function extractOutline(
  pdf: PdfDocumentProxy,
): Promise<TocItem[]> {
  const outline = await pdf.getOutline();
  if (!outline || outline.length === 0) return [];
  return convertOutlineItems(pdf, outline as PdfJsOutlineItem[], 0);
}

