/**
 * Extract book metadata from filenames and PDF document info.
 */
import { PDFDocument } from "pdf-lib";

export interface ExtractedMetadata {
  title: string;
  author: string;
}

/* ------------------------------------------------------------------ */
/*  Filename-based extraction                                          */
/* ------------------------------------------------------------------ */

/**
 * Common filename patterns:
 *   "Author - Title.pdf"
 *   "Title (Author).pdf"
 *   "Title [Author].pdf"
 *   "Title.pdf"  (no author)
 */
export function extractFromFilename(filePath: string): ExtractedMetadata {
  const base = filePath.split("/").pop() || filePath;
  const name = base.replace(/\.pdf$/i, "").trim();

  // Pattern: "Author - Title"
  const dashMatch = name.match(/^(.+?)\s*[-–—]\s*(.+)$/);
  if (dashMatch) {
    const left = dashMatch[1].trim();
    const right = dashMatch[2].trim();
    // Heuristic: if the left part looks like a name (contains space, and
    // is shorter), treat it as author.  Otherwise use right half.
    if (left.includes(" ") && left.length < right.length) {
      return { title: right, author: left };
    }
    return { title: name, author: "" };
  }

  // Pattern: "Title (Author)" or "Title [Author]"
  const parenMatch = name.match(/^(.+?)\s*[(\[]\s*(.+?)\s*[)\]]$/);
  if (parenMatch) {
    return {
      title: parenMatch[1].trim(),
      author: parenMatch[2].trim(),
    };
  }

  // Fallback: clean up underscores / dots
  const cleaned = name.replace(/[_]/g, " ").replace(/\s+/g, " ").trim();
  return { title: cleaned, author: "" };
}

/* ------------------------------------------------------------------ */
/*  PDF document-info extraction                                       */
/* ------------------------------------------------------------------ */

/**
 * Parse the PDF /Info dictionary for Title and Author.
 * Falls back to filename-derived values when fields are absent.
 */
export async function extractFromPdf(
  pdfBytes: Uint8Array,
  filePath: string,
): Promise<ExtractedMetadata> {
  const fallback = extractFromFilename(filePath);

  try {
    const doc = await PDFDocument.load(pdfBytes, {
      updateMetadata: false,
    });
    const pdfTitle = doc.getTitle()?.trim();
    const pdfAuthor = doc.getAuthor()?.trim();

    return {
      title: pdfTitle && pdfTitle.length > 0 ? pdfTitle : fallback.title,
      author: pdfAuthor && pdfAuthor.length > 0 ? pdfAuthor : fallback.author,
    };
  } catch {
    // Encrypted / damaged PDFs – fall back gracefully
    return fallback;
  }
}
