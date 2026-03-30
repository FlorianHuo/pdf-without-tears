/**
 * Render PDF pages to base64-encoded JPEG images.
 *
 * Uses an OffscreenCanvas (or regular canvas fallback) to render
 * pages at a controllable scale. Lower scale = smaller images = fewer tokens.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PDFDocumentProxy = any;

// Default render scale: 1.5 gives good text readability while keeping
// image size manageable (roughly 200-400KB per page as JPEG)
const DEFAULT_SCALE = 1.5;
const JPEG_QUALITY = 0.75;

/**
 * Render a single PDF page to a base64 JPEG data URL.
 *
 * @param pdf - The PDFDocumentProxy from pdf.js
 * @param pageNumber - 1-indexed page number
 * @param scale - Render scale factor (default 1.5)
 * @returns base64 data URL string (e.g. "data:image/jpeg;base64,...")
 */
export async function renderPageToBase64(
  pdf: PDFDocumentProxy,
  pageNumber: number,
  scale: number = DEFAULT_SCALE,
): Promise<string> {
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale });

  // Use OffscreenCanvas if available (better performance, no DOM needed)
  // Falls back to regular canvas for compatibility
  let canvas: HTMLCanvasElement | OffscreenCanvas;
  let ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

  if (typeof OffscreenCanvas !== "undefined") {
    canvas = new OffscreenCanvas(viewport.width, viewport.height);
    ctx = canvas.getContext("2d")!;
  } else {
    canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    ctx = canvas.getContext("2d")!;
  }

  // Render the page
  await page.render({
    canvasContext: ctx,
    viewport,
  }).promise;

  // Convert to base64 JPEG
  if (canvas instanceof OffscreenCanvas) {
    const blob = await canvas.convertToBlob({
      type: "image/jpeg",
      quality: JPEG_QUALITY,
    });
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } else {
    return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  }
}

/**
 * Render multiple PDF pages to base64 JPEG data URLs.
 *
 * @param pdf - The PDFDocumentProxy from pdf.js
 * @param startPage - First page to render (1-indexed)
 * @param endPage - Last page to render (1-indexed, inclusive)
 * @param scale - Render scale factor
 * @param onProgress - Progress callback (pageNumber, totalPages)
 * @returns Array of base64 data URL strings
 */
export async function renderPagesToBase64(
  pdf: PDFDocumentProxy,
  startPage: number,
  endPage: number,
  scale: number = DEFAULT_SCALE,
  onProgress?: (current: number, total: number) => void,
): Promise<string[]> {
  const results: string[] = [];
  const total = endPage - startPage + 1;

  for (let i = startPage; i <= endPage; i++) {
    onProgress?.(i - startPage + 1, total);
    const dataUrl = await renderPageToBase64(pdf, i, scale);
    results.push(dataUrl);
  }

  return results;
}
