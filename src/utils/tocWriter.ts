/**
 * Write a TocItem[] tree back into a PDF file using pdf-lib + outline-pdf.
 */
import type { TocItem } from "../types/toc";
import { outlinePdfFactory } from "@lillallol/outline-pdf";
import * as pdfLib from "pdf-lib";

/**
 * Convert our TocItem tree to the outline-pdf string format.
 * Format: "pageNumber|depthDashes|title"
 * Depth is represented by dashes: "" = level 0, "-" = level 1, "--" = level 2
 */
function tocItemsToOutlineString(items: TocItem[]): string {
  const lines: string[] = [];

  function flatten(item: TocItem) {
    const dashes = "-".repeat(item.depth);
    // Escape pipe characters in title to prevent format corruption
    const safeTitle = item.title.replace(/\|/g, " ");
    lines.push(`${item.pageNumber}|${dashes}|${safeTitle}`);
    for (const child of item.children) {
      flatten(child);
    }
  }

  for (const item of items) {
    flatten(item);
  }

  return lines.join("\n");
}

/**
 * Inject a TocItem[] outline into PDF bytes and return the modified PDF bytes.
 *
 * @param pdfBytes - The original PDF file as Uint8Array
 * @param tocItems - The TOC tree to write
 * @returns Modified PDF bytes with the new outline
 */
export async function writeTocToPdf(
  pdfBytes: Uint8Array,
  tocItems: TocItem[],
): Promise<Uint8Array> {
  if (tocItems.length === 0) {
    // Nothing to write - return original bytes
    return pdfBytes;
  }

  const outlineString = tocItemsToOutlineString(tocItems);
  const outlinePdf = outlinePdfFactory(pdfLib);

  // outlinePdf returns a PDFDocument, call .save() to get bytes
  const pdfDoc = await outlinePdf({
    pdf: pdfBytes,
    outline: outlineString,
  });

  return new Uint8Array(await pdfDoc.save());
}
