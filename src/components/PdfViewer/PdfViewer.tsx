import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import styles from "./PdfViewer.module.css";

// Configure pdf.js worker - MUST be in the same file as <Document>
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

// How many pages to render above/below the viewport
const OVERSCAN = 2;
// Gap between pages in px
const PAGE_GAP = 16;
// Padding top/bottom of the scroll container
const CONTAINER_PADDING = 24;

export default function PdfViewer({
  fileUrl,
  currentPage,
  zoom,
  onDocumentLoad,
  onPageChange,
}: PdfViewerProps) {
  const [numPages, setNumPages] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isUserScrollRef = useRef(true);

  // Page dimensions: use A4 aspect ratio as estimate
  const pageWidth = useMemo(
    () => Math.max(200, (containerWidth - 80) * zoom),
    [containerWidth, zoom],
  );
  const pageHeight = useMemo(() => pageWidth * 1.414, [pageWidth]);

  // Total scrollable height
  const totalHeight = useMemo(
    () =>
      numPages > 0
        ? numPages * pageHeight +
          (numPages - 1) * PAGE_GAP +
          CONTAINER_PADDING * 2
        : 0,
    [numPages, pageHeight],
  );

  // Given a page number (1-indexed), return its top offset
  const getPageTop = useCallback(
    (page: number) =>
      CONTAINER_PADDING + (page - 1) * (pageHeight + PAGE_GAP),
    [pageHeight],
  );

  // Observe container dimensions
  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        setContainerWidth(e.contentRect.width);
        setContainerHeight(e.contentRect.height);
      }
    });
    ro.observe(node);
    setContainerWidth(node.clientWidth);
    setContainerHeight(node.clientHeight);
    return () => ro.disconnect();
  }, []);

  // Calculate visible page range from scroll position
  const [scrollTop, setScrollTop] = useState(0);

  const visibleRange = useMemo(() => {
    if (numPages === 0 || containerHeight === 0) return { start: 1, end: 1 };

    const rowH = pageHeight + PAGE_GAP;
    // First visible page (0-indexed, then +1)
    const firstVisible =
      Math.max(0, Math.floor((scrollTop - CONTAINER_PADDING) / rowH)) + 1;
    // Last visible page
    const lastVisible =
      Math.min(
        numPages,
        Math.ceil(
          (scrollTop + containerHeight - CONTAINER_PADDING) / rowH,
        ),
      );

    return {
      start: Math.max(1, firstVisible - OVERSCAN),
      end: Math.min(numPages, lastVisible + OVERSCAN),
    };
  }, [scrollTop, numPages, pageHeight, containerHeight]);

  // Current page derived from scroll position
  const scrollDerivedPage = useMemo(() => {
    if (numPages === 0) return 1;
    const rowH = pageHeight + PAGE_GAP;
    // Page whose top is closest to 30% of viewport
    const targetY = scrollTop + containerHeight * 0.3;
    const page = Math.round((targetY - CONTAINER_PADDING) / rowH) + 1;
    return Math.max(1, Math.min(numPages, page));
  }, [scrollTop, numPages, pageHeight, containerHeight]);

  // Propagate page change from scroll
  useEffect(() => {
    if (isUserScrollRef.current && scrollDerivedPage !== currentPage) {
      onPageChange(scrollDerivedPage);
    }
  }, [scrollDerivedPage, currentPage, onPageChange]);

  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    isUserScrollRef.current = true;
    setScrollTop(container.scrollTop);
  }, []);

  // Scroll to page when currentPage changes from toolbar / sidebar
  useEffect(() => {
    const container = containerRef.current;
    if (!container || numPages === 0) return;

    const targetTop = getPageTop(currentPage);
    const currentScroll = container.scrollTop;

    // Only scroll if the target page isn't already in view
    if (Math.abs(targetTop - currentScroll) > containerHeight * 0.3) {
      isUserScrollRef.current = false;
      container.scrollTo({ top: targetTop - 8, behavior: "smooth" });
    }
  }, [currentPage, numPages, getPageTop, containerHeight]);

  function onDocumentLoadSuccess({ numPages: n }: { numPages: number }) {
    setNumPages(n);
    onDocumentLoad(n);
  }

  // Build list of pages to render (only the visible window)
  const pagesToRender = useMemo(() => {
    const pages: number[] = [];
    for (let i = visibleRange.start; i <= visibleRange.end; i++) {
      pages.push(i);
    }
    return pages;
  }, [visibleRange]);

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
        {/* Single div as tall as all pages, holds absolutely positioned children */}
        <div className={styles.virtualList} style={{ height: totalHeight }}>
          {pagesToRender.map((pageNum) => (
            <div
              key={`page_${pageNum}`}
              className={styles.pageWrapper}
              data-page-number={pageNum}
              style={{
                position: "absolute",
                top: getPageTop(pageNum),
                left: "50%",
                transform: "translateX(-50%)",
              }}
            >
              <Page
                pageNumber={pageNum}
                width={pageWidth}
                renderTextLayer={true}
                renderAnnotationLayer={true}
                loading={
                  <div
                    className={styles.pagePlaceholder}
                    style={{ width: pageWidth, height: pageHeight }}
                  >
                    <span className={styles.placeholderLabel}>{pageNum}</span>
                  </div>
                }
              />
            </div>
          ))}
        </div>
      </Document>
    </div>
  );
}
