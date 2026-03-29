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

// Number of off-screen pages to keep rendered above/below the viewport
const BUFFER_PAGES = 3;

export default function PdfViewer({
  fileUrl,
  currentPage,
  zoom,
  onDocumentLoad,
  onPageChange,
}: PdfViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const [visiblePages, setVisiblePages] = useState<Set<number>>(new Set([1]));
  const containerNodeRef = useRef<HTMLDivElement | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  // Ref to prevent scroll-to-page from triggering onPageChange feedback loop
  const isScrollingToPageRef = useRef(false);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Estimated page height for placeholders (A4 aspect ratio = 1:1.414)
  const pageHeight = useMemo(() => {
    const pw = Math.max(200, (containerWidth - 80) * zoom);
    return pw * 1.414;
  }, [containerWidth, zoom]);

  const pageWidth = useMemo(() => {
    return Math.max(200, (containerWidth - 80) * zoom);
  }, [containerWidth, zoom]);

  // Track which pages are visible using IntersectionObserver
  // We expand the rootMargin so pages slightly off-screen are pre-rendered
  const setupObserver = useCallback(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    const container = containerNodeRef.current;
    if (!container) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        setVisiblePages((prev) => {
          const next = new Set(prev);
          for (const entry of entries) {
            const pageNum = parseInt(
              entry.target.getAttribute("data-page-number") || "0",
            );
            if (pageNum === 0) continue;
            if (entry.isIntersecting) {
              next.add(pageNum);
            } else {
              next.delete(pageNum);
            }
          }
          return next;
        });
      },
      {
        root: container,
        // Pre-render pages 1 full viewport above and below
        rootMargin: "100% 0px 100% 0px",
        threshold: 0,
      },
    );

    // Observe all page wrappers
    const wrappers = container.querySelectorAll("[data-page-number]");
    wrappers.forEach((el) => observerRef.current!.observe(el));
  }, []);

  // ContainerRef callback: measure width + setup observer
  const setContainerRef = useCallback(
    (node: HTMLDivElement | null) => {
      containerNodeRef.current = node;
      if (node) {
        const resizeObserver = new ResizeObserver((entries) => {
          for (const entry of entries) {
            setContainerWidth(entry.contentRect.width);
          }
        });
        resizeObserver.observe(node);
        setContainerWidth(node.clientWidth);
      }
    },
    [],
  );

  // Re-setup IntersectionObserver whenever numPages changes
  useEffect(() => {
    if (numPages > 0) {
      // Give DOM a tick to render the placeholder divs
      requestAnimationFrame(() => setupObserver());
    }
    return () => {
      if (observerRef.current) observerRef.current.disconnect();
    };
  }, [numPages, setupObserver]);

  function onDocumentLoadSuccess({ numPages: n }: { numPages: number }) {
    setNumPages(n);
    setVisiblePages(new Set([1, 2, 3]));
    onDocumentLoad(n);
  }

  // Determine which pages should be rendered (visible + buffer)
  const renderedPages = useMemo(() => {
    const result = new Set<number>();
    for (const p of visiblePages) {
      for (
        let i = Math.max(1, p - BUFFER_PAGES);
        i <= Math.min(numPages, p + BUFFER_PAGES);
        i++
      ) {
        result.add(i);
      }
    }
    return result;
  }, [visiblePages, numPages]);

  // Track current page based on scroll position (throttled)
  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      // Skip if we're programmatically scrolling to a page
      if (isScrollingToPageRef.current) return;

      const container = e.currentTarget;
      const containerRect = container.getBoundingClientRect();
      // The "current page" is the one whose top edge is closest to 30% from top
      const targetY = containerRect.top + containerRect.height * 0.3;

      const wrappers = container.querySelectorAll("[data-page-number]");
      let closestPage = currentPage;
      let closestDist = Infinity;

      for (const el of wrappers) {
        const rect = el.getBoundingClientRect();
        const dist = Math.abs(rect.top - targetY);
        if (dist < closestDist) {
          closestDist = dist;
          closestPage = parseInt(
            el.getAttribute("data-page-number") || "1",
          );
        }
      }

      if (closestPage !== currentPage) {
        onPageChange(closestPage);
      }
    },
    [currentPage, onPageChange],
  );

  // Scroll to page when currentPage changes from toolbar/sidebar
  useEffect(() => {
    const container = containerNodeRef.current;
    if (!container || numPages === 0) return;

    const pageEl = container.querySelector(
      `[data-page-number="${currentPage}"]`,
    );
    if (!pageEl) return;

    // Check if the page is already reasonably in view
    const containerRect = container.getBoundingClientRect();
    const pageRect = pageEl.getBoundingClientRect();
    const isInView =
      pageRect.top >= containerRect.top - 50 &&
      pageRect.top <= containerRect.top + containerRect.height * 0.5;

    if (!isInView) {
      isScrollingToPageRef.current = true;
      pageEl.scrollIntoView({ behavior: "smooth", block: "start" });

      // Release the scroll lock after the smooth scroll finishes
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = setTimeout(() => {
        isScrollingToPageRef.current = false;
      }, 500);
    }
  }, [currentPage, numPages]);

  if (!fileUrl) return null;

  return (
    <div
      className={styles.container}
      ref={setContainerRef}
      onScroll={handleScroll}
    >
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
        {Array.from(new Array(numPages), (_, index) => {
          const pageNum = index + 1;
          const shouldRender = renderedPages.has(pageNum);

          return (
            <div
              key={`page_${pageNum}`}
              className={styles.pageWrapper}
              data-page-number={pageNum}
              style={{
                // Use min-height so the wrapper keeps its space
                // even when the page is not rendered
                minHeight: shouldRender ? undefined : pageHeight,
              }}
            >
              {shouldRender ? (
                <Page
                  pageNumber={pageNum}
                  width={pageWidth}
                  renderTextLayer={true}
                  renderAnnotationLayer={true}
                  loading={
                    <div
                      className={styles.pagePlaceholder}
                      style={{
                        width: pageWidth,
                        height: pageHeight,
                      }}
                    />
                  }
                />
              ) : (
                <div
                  className={styles.pagePlaceholder}
                  style={{ width: pageWidth, height: pageHeight }}
                >
                  <span className={styles.placeholderLabel}>{pageNum}</span>
                </div>
              )}
            </div>
          );
        })}
      </Document>
    </div>
  );
}
