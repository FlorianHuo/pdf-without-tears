import { pdfjs } from "react-pdf";

// Configure pdf.js worker — shared across PdfViewer and thumbnail generator
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

export const pdfDocumentOptions = {
  cMapUrl: "/pdfjs/cmaps/",
  cMapPacked: true,
  standardFontDataUrl: "/pdfjs/standard_fonts/",
  useSystemFonts: true,
} as const;

export { pdfjs };
