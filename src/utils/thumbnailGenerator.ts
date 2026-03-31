import { pdfjs } from "./pdfSetup";
import { writeFile } from "@tauri-apps/plugin-fs";
import { appDataDir } from "@tauri-apps/api/path";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PDFDocumentProxy = any;

const THUMB_SCALE = 0.5;
const JPEG_QUALITY = 0.8;

function createRenderCanvas(width: number, height: number) {
  if (typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.ceil(width));
    canvas.height = Math.max(1, Math.ceil(height));
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Failed to create 2D canvas context.");
    }
    return { canvas, context };
  }

  if (typeof OffscreenCanvas !== "undefined") {
    const canvas = new OffscreenCanvas(
      Math.max(1, Math.ceil(width)),
      Math.max(1, Math.ceil(height)),
    );
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Failed to create offscreen canvas context.");
    }
    return { canvas, context };
  }

  throw new Error("No canvas implementation available.");
}

async function canvasToJpegBytes(
  canvas: HTMLCanvasElement | OffscreenCanvas,
): Promise<Uint8Array> {
  if (canvas instanceof HTMLCanvasElement) {
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (value) => {
          if (value) {
            resolve(value);
            return;
          }
          reject(new Error("Failed to encode thumbnail image."));
        },
        "image/jpeg",
        JPEG_QUALITY,
      );
    });
    return new Uint8Array(await blob.arrayBuffer());
  }

  const blob = await canvas.convertToBlob({
    type: "image/jpeg",
    quality: JPEG_QUALITY,
  });
  return new Uint8Array(await blob.arrayBuffer());
}

/**
 * Generate a cover thumbnail for a PDF and save it to the app data directory.
 * Returns the full path to the saved thumbnail.
 */
export async function generateThumbnail(
  pdfBytes: Uint8Array,
  bookId: number,
): Promise<string> {
  const pdf: PDFDocumentProxy = await pdfjs.getDocument({ data: pdfBytes }).promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: THUMB_SCALE });

  const { canvas, context } = createRenderCanvas(
    viewport.width,
    viewport.height,
  );

  await page.render({ canvasContext: context, viewport }).promise;
  const jpegBytes = await canvasToJpegBytes(canvas);

  page.cleanup();
  await pdf.destroy();

  // Write to app data directory
  const dataDir = await appDataDir();
  const thumbPath = `${dataDir}thumbnails/${bookId}.jpg`;
  await writeFile(thumbPath, jpegBytes);

  return thumbPath;
}

/**
 * Get total page count from PDF bytes without rendering.
 */
export async function getPdfPageCount(pdfBytes: Uint8Array): Promise<number> {
  const pdf = await pdfjs.getDocument({ data: pdfBytes }).promise;
  const count = pdf.numPages;
  pdf.destroy();
  return count;
}
