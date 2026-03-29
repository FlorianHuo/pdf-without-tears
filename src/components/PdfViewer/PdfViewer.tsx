import { useState, useCallback, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import styles from "./PdfViewer.module.css";

// Configure pdf.js worker
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

interface PdfViewerProps {
  fileUrl: string | null;
  currentPage: number;
  zoom: number;
  onDocumentLoad: (numPages: number) => void;
  onPageChange: (page: number) => void;
}

export default function PdfViewer({
  fileUrl,
  currentPage,
  zoom,
  onDocumentLoad,
  onPageChange,
}: PdfViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const containerRef = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          setContainerWidth(entry.contentRect.width);
        }
      });
      observer.observe(node);
      setContainerWidth(node.clientWidth);
    }
  }, []);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
    onDocumentLoad(numPages);
  }

  // Calculate page width based on zoom level
  // zoom = 1.0 means "fit width" (page fills container width with some padding)
  const pageWidth = Math.max(200, (containerWidth - 80) * zoom);

  // Handle scroll-based page tracking
  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const container = e.currentTarget;
      const scrollTop = container.scrollTop;
      const children = container.querySelectorAll("[data-page-number]");

      let closestPage = currentPage;
      let closestDistance = Infinity;

      children.forEach((child) => {
        const rect = child.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        const distance = Math.abs(
          rect.top - containerRect.top - containerRect.height * 0.3,
        );
        if (distance < closestDistance) {
          closestDistance = distance;
          closestPage = parseInt(
            child.getAttribute("data-page-number") || "1",
          );
        }
      });

      if (closestPage !== currentPage) {
        onPageChange(closestPage);
      }
    },
    [currentPage, onPageChange],
  );

  // Scroll to page when currentPage changes via toolbar
  useEffect(() => {
    const pageEl = document.querySelector(
      `[data-page-number="${currentPage}"]`,
    );
    if (pageEl) {
      pageEl.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [currentPage]);

  if (!fileUrl) return null;

  return (
    <div className={styles.container} ref={containerRef} onScroll={handleScroll}>
      <Document
        file={fileUrl}
        onLoadSuccess={onDocumentLoadSuccess}
        loading={
          <div className={styles.loading}>
            <div className={styles.spinner} />
            <span>Loading PDF...</span>
          </div>
        }
        error={
          <div className={styles.error}>
            <span>Failed to load PDF</span>
          </div>
        }
      >
        {Array.from(new Array(numPages), (_, index) => (
          <div
            key={`page_${index + 1}`}
            className={styles.pageWrapper}
            data-page-number={index + 1}
          >
            <Page
              pageNumber={index + 1}
              width={pageWidth}
              renderTextLayer={true}
              renderAnnotationLayer={true}
              loading={
                <div
                  className={styles.pagePlaceholder}
                  style={{ width: pageWidth, height: pageWidth * 1.414 }}
                />
              }
            />
          </div>
        ))}
      </Document>
    </div>
  );
}
