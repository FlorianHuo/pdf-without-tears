import {
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
  useLayoutEffect,
} from "react";
import { Document, Page } from "react-pdf";
import { pdfDocumentOptions } from "../../utils/pdfSetup";
import { extractOutline } from "../../utils/tocExtractor";
import type { TocItem } from "../../types/toc";
// Annotation layer disabled: popup annotations render inline and break layout
import "react-pdf/dist/Page/TextLayer.css";
import styles from "./PdfViewer.module.css";

export type ZoomMode = "fit-width" | "fit-page" | "custom";

interface PdfViewerProps {
  fileUrl: string | null;
  currentPage: number;
  zoom: number;
  zoomMode: ZoomMode;
  onDocumentLoad: (numPages: number) => void;
  onPageChange: (page: number) => void;
  onOutlineLoad: (items: TocItem[]) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onPdfLoad?: (pdf: any) => void;
}

// How many pages to render above/below the viewport
const OVERSCAN = 2;
// Gap between pages in px
const PAGE_GAP = 0;
// Padding top/bottom of the scroll container
const CONTAINER_PADDING = 0;
// Horizontal padding around pages
const PAGE_HPADDING = 0;
// Default aspect ratio (A4), will be replaced by actual PDF page ratio
const DEFAULT_ASPECT = 1.414;

export default function PdfViewer({
  fileUrl,
  currentPage,
  zoom,
  zoomMode,
  onDocumentLoad,
  onPageChange,
  onOutlineLoad,
  onPdfLoad,
}: PdfViewerProps) {
  const [numPages, setNumPages] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  // Per-page aspect ratios (height/width), indexed from 0 (page 1 = index 0)
  const [pageAspects, setPageAspects] = useState<number[]>([]);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // The "main" aspect ratio for fit-page mode (most common across pages)
  const mainAspect = useMemo(() => {
    if (pageAspects.length === 0) return DEFAULT_ASPECT;
    // Use the median aspect ratio as the representative one
    const sorted = [...pageAspects].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  }, [pageAspects]);

  // Compute page width based on zoom mode
  const pageWidth = useMemo(() => {
    const availW = containerWidth - PAGE_HPADDING * 2;
    if (availW <= 0) return 200;

    if (zoomMode === "fit-width") {
      return availW;
    } else if (zoomMode === "fit-page") {
      const fitByHeight = containerHeight / mainAspect;
      return Math.min(availW, fitByHeight);
    } else {
      return Math.max(200, availW * zoom);
    }
  }, [containerWidth, containerHeight, zoom, zoomMode, mainAspect]);

  // Per-page heights at current pageWidth
  const pageHeights = useMemo(() => {
    if (pageAspects.length === 0) return [];
    return pageAspects.map(aspect => pageWidth * aspect);
  }, [pageAspects, pageWidth]);

  // Fallback single pageHeight (for scroll calcs before pageAspects loaded)
  const pageHeight = useMemo(
    () => pageWidth * mainAspect,
    [pageWidth, mainAspect],
  );

  // Prefix-sum offsets: pageTops[i] = top position of page i+1 (0-indexed)
  const pageTops = useMemo(() => {
    if (pageHeights.length === 0) return [];
    const tops: number[] = [CONTAINER_PADDING];
    for (let i = 1; i < pageHeights.length; i++) {
      tops.push(tops[i - 1] + pageHeights[i - 1] + PAGE_GAP);
    }
    return tops;
  }, [pageHeights]);

  // Total scrollable height
  const totalHeight = useMemo(() => {
    if (numPages === 0) return 0;
    if (zoomMode === "fit-page") {
      return numPages * containerHeight;
    }
    if (pageTops.length > 0 && pageHeights.length > 0) {
      return pageTops[pageTops.length - 1] + pageHeights[pageHeights.length - 1] + CONTAINER_PADDING;
    }
    // Fallback: use default aspect ratio while pageAspects are loading
    return numPages * pageHeight + CONTAINER_PADDING * 2;
  }, [numPages, zoomMode, containerHeight, pageTops, pageHeights, pageHeight]);

  // Given a page number (1-indexed), return its top offset
  const getPageTop = useCallback(
    (page: number) => {
      if (zoomMode === "fit-page" && containerHeight > 0) {
        return (page - 1) * containerHeight;
      }
      if (pageTops.length > 0) {
        const idx = Math.max(0, Math.min(page - 1, pageTops.length - 1));
        return pageTops[idx];
      }
      return CONTAINER_PADDING + (page - 1) * (pageHeight + PAGE_GAP);
    },
    [zoomMode, containerHeight, pageTops, pageHeight],
  );

  // Get height of a specific page (1-indexed)
  const getPageHeight = useCallback(
    (page: number) => {
      if (pageHeights.length > 0) {
        const idx = Math.max(0, Math.min(page - 1, pageHeights.length - 1));
        return pageHeights[idx];
      }
      return pageHeight;
    },
    [pageHeights, pageHeight],
  );

  // Observe container dimensions
  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const ro = new ResizeObserver(() => {
      // Use clientWidth to exclude scrollbar width
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth);
        setContainerHeight(containerRef.current.clientHeight);
      }
    });
    ro.observe(node);
    setContainerWidth(node.clientWidth);
    setContainerHeight(node.clientHeight);
    return () => ro.disconnect();
  }, []);

  // ---- Scroll tracking ----
  const [scrollTop, setScrollTop] = useState(0);

  // Keep getPageTop in a ref so the scroll-to-page effect doesn't
  // re-trigger when layout recalculates
  const getPageTopRef = useRef(getPageTop);
  getPageTopRef.current = getPageTop;

  // Guard flag: true while we are programmatically scrolling
  const isProgrammaticScrollRef = useRef(false);
  const scrollGuardTimeoutRef = useRef<number | null>(null);

  const scheduleProgrammaticScrollRelease = useCallback((delay = 120) => {
    if (scrollGuardTimeoutRef.current !== null) {
      window.clearTimeout(scrollGuardTimeoutRef.current);
    }
    scrollGuardTimeoutRef.current = window.setTimeout(() => {
      isProgrammaticScrollRef.current = false;
      scrollGuardTimeoutRef.current = null;
    }, delay);
  }, []);

  useEffect(() => {
    return () => {
      if (scrollGuardTimeoutRef.current !== null) {
        window.clearTimeout(scrollGuardTimeoutRef.current);
      }
    };
  }, []);

  const syncToPage = useCallback(
    (page: number, behavior: ScrollBehavior = "auto") => {
      const container = containerRef.current;
      if (!container || numPages === 0) return;

      const targetTop = getPageTopRef.current(page);
      isProgrammaticScrollRef.current = true;
      setScrollTop(targetTop);
      container.scrollTo({ top: targetTop, behavior });
      scheduleProgrammaticScrollRelease(behavior === "smooth" ? 400 : 120);
    },
    [numPages, scheduleProgrammaticScrollRelease],
  );

  // Track the last page set by the parent (toolbar/sidebar) so we can
  // distinguish it from scroll-derived page changes.
  const lastExternalPageRef = useRef(currentPage);

  // When currentPage prop changes, record it as an external navigation
  // and immediately scroll to that page.
  useLayoutEffect(() => {
    if (currentPage === lastExternalPageRef.current) return;
    lastExternalPageRef.current = currentPage;

    const container = containerRef.current;
    if (!container || numPages === 0) return;

    const targetTop = getPageTopRef.current(currentPage);
    const currentScroll = container.scrollTop;
    const distance = Math.abs(targetTop - currentScroll);

    if (distance < 5) return;

    syncToPage(
      currentPage,
      zoomMode === "fit-page" || distance > containerHeight * 3 ? "auto" : "smooth",
    );
  }, [currentPage, numPages, containerHeight, zoomMode, syncToPage]);

  // Tracks the last scroll-derived page number
  const prevScrollDerivedRef = useRef(1);

  // Keep the active page anchored when the fit-page layout changes.
  const prevZoomModeRef = useRef(zoomMode);
  const prevFitPageHeightRef = useRef(containerHeight);
  useLayoutEffect(() => {
    const zoomChanged = prevZoomModeRef.current !== zoomMode;
    const fitPageHeightChanged =
      zoomMode === "fit-page" &&
      prevFitPageHeightRef.current > 0 &&
      prevFitPageHeightRef.current !== containerHeight;

    prevZoomModeRef.current = zoomMode;
    prevFitPageHeightRef.current = containerHeight;

    if (!zoomChanged && !fitPageHeightChanged) return;
    if (containerHeight === 0 || numPages === 0) return;

    prevScrollDerivedRef.current = currentPage;
    lastExternalPageRef.current = currentPage;
    syncToPage(currentPage, "auto");
  }, [zoomMode, containerHeight, currentPage, numPages, syncToPage]);

  // Compute which page the user is looking at based on scroll position
  const scrollDerivedPage = useMemo(() => {
    if (numPages === 0) return 1;
    if (zoomMode === "fit-page" && containerHeight > 0) {
      const page = Math.floor((scrollTop + containerHeight * 0.5) / containerHeight) + 1;
      return Math.max(1, Math.min(numPages, page));
    }
    const targetY = scrollTop + containerHeight * 0.3;
    if (pageTops.length > 0) {
      let lo = 0, hi = pageTops.length - 1;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (pageTops[mid] <= targetY) lo = mid;
        else hi = mid - 1;
      }
      return Math.max(1, Math.min(numPages, lo + 1));
    }
    const rowH = pageHeight + PAGE_GAP;
    const page = Math.round((targetY - CONTAINER_PADDING) / rowH) + 1;
    return Math.max(1, Math.min(numPages, page));
  }, [scrollTop, numPages, pageHeight, containerHeight, zoomMode, pageTops]);

  // Propagate scroll-derived page back to parent
  useEffect(() => {
    if (scrollDerivedPage === prevScrollDerivedRef.current) return;
    prevScrollDerivedRef.current = scrollDerivedPage;

    if (isProgrammaticScrollRef.current) return;

    lastExternalPageRef.current = scrollDerivedPage;
    onPageChange(scrollDerivedPage);
  }, [scrollDerivedPage, onPageChange]);

  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    setScrollTop(container.scrollTop);
  }, []);

  // ---- Visible page range (for windowed rendering) ----
  const visibleRange = useMemo(() => {
    if (numPages === 0 || containerHeight === 0) return { start: 1, end: 1 };

    if (zoomMode === "fit-page" && containerHeight > 0) {
      const currentPage = Math.floor(scrollTop / containerHeight) + 1;
      const start = Math.max(1, currentPage - OVERSCAN);
      const end = Math.min(numPages, currentPage + OVERSCAN);
      return { start, end };
    }

    // Binary search for first visible page
    if (pageTops.length > 0) {
      let lo = 0, hi = pageTops.length - 1;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (pageTops[mid] <= scrollTop) lo = mid;
        else hi = mid - 1;
      }
      const firstVisible = lo + 1;
      // Find last visible
      let lastVisible = firstVisible;
      const bottomEdge = scrollTop + containerHeight;
      while (lastVisible < numPages && getPageTop(lastVisible + 1) < bottomEdge) {
        lastVisible++;
      }
      return {
        start: Math.max(1, firstVisible - OVERSCAN),
        end: Math.min(numPages, lastVisible + OVERSCAN),
      };
    }

    const rowH = pageHeight + PAGE_GAP;
    const firstVisible =
      Math.max(0, Math.floor((scrollTop - CONTAINER_PADDING) / rowH)) + 1;
    const lastVisible = Math.min(
      numPages,
      Math.ceil((scrollTop + containerHeight - CONTAINER_PADDING) / rowH),
    );

    return {
      start: Math.max(1, firstVisible - OVERSCAN),
      end: Math.min(numPages, lastVisible + OVERSCAN),
    };
  }, [scrollTop, numPages, pageHeight, containerHeight, zoomMode, pageTops, getPageTop]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function onDocumentLoadSuccess(pdf: any) {
    const n = pdf.numPages;
    setNumPages(n);
    onDocumentLoad(n);
    onPdfLoad?.(pdf);

    // Read actual page dimensions from ALL pages
    try {
      const aspects: number[] = [];
      for (let i = 1; i <= n; i++) {
        const page = await pdf.getPage(i);
        const vp = page.getViewport({ scale: 1 });
        aspects.push(vp.width > 0 && vp.height > 0 ? vp.height / vp.width : DEFAULT_ASPECT);
      }
      setPageAspects(aspects);
    } catch {
      // Fallback: try just page 1
      try {
        const page1 = await pdf.getPage(1);
        const vp = page1.getViewport({ scale: 1 });
        const aspect = vp.width > 0 && vp.height > 0 ? vp.height / vp.width : DEFAULT_ASPECT;
        setPageAspects(Array(n).fill(aspect));
      } catch {
        setPageAspects(Array(n).fill(DEFAULT_ASPECT));
      }
    }

    // Extract outline (TOC) from the loaded document
    try {
      const outline = await extractOutline(pdf);
      onOutlineLoad(outline);
    } catch (err) {
      console.error("Failed to extract outline:", err);
      onOutlineLoad([]);
    }
  }

  const pagesToRender = useMemo(() => {
    const pages: number[] = [];
    for (let i = visibleRange.start; i <= visibleRange.end; i++) {
      pages.push(i);
    }
    return pages;
  }, [visibleRange]);

  if (!fileUrl) return null;

  return (
    <div
      className={`${styles.container} ${zoomMode === "fit-page" ? styles.snapContainer : ""}`}
      ref={containerRef}
      onScroll={handleScroll}
    >
      <Document
        file={fileUrl}
        options={pdfDocumentOptions}
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
        <div className={styles.virtualList} style={{ height: totalHeight }}>
          {pagesToRender.map((pageNum) => (
            <div
              key={`page_${pageNum}`}
              className={`${styles.pageWrapper} ${zoomMode === "fit-page" ? styles.snapPage : ""}`}
              data-page-number={pageNum}
              style={{
                position: "absolute",
                top: getPageTop(pageNum),
                left: "50%",
                transform: "translateX(-50%)",
                width: pageWidth,
                height: zoomMode === "fit-page" ? containerHeight : getPageHeight(pageNum),
                overflow: "hidden",
                ...(zoomMode === "fit-page" ? { display: "flex", alignItems: "center", justifyContent: "center" } : {}),
              }}
            >
              <Page
                pageNumber={pageNum}
                width={pageWidth}
                renderTextLayer={true}
                renderAnnotationLayer={false}
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
