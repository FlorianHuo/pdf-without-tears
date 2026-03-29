import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { Document, Page } from "react-pdf";
import styles from "./Sidebar.module.css";

interface SidebarProps {
  visible: boolean;
  fileUrl: string | null;
  totalPages: number;
  currentPage: number;
  onPageChange: (page: number) => void;
}

// Thumbnail dimensions
const THUMB_WIDTH = 150;
const THUMB_HEIGHT = Math.round(THUMB_WIDTH * 1.55); // generous ratio for various page sizes
const ITEM_GAP = 8; // gap between items
const ITEM_PADDING = 8; // padding inside each button
const LABEL_HEIGHT = 18; // height reserved for page number label
const ITEM_HEIGHT = THUMB_HEIGHT + ITEM_PADDING * 2 + LABEL_HEIGHT + ITEM_GAP;
const OVERSCAN = 3;

export default function Sidebar({
  visible,
  fileUrl,
  totalPages,
  currentPage,
  onPageChange,
}: SidebarProps) {
  const listRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [listHeight, setListHeight] = useState(0);

  // Observe list container height
  useEffect(() => {
    const node = listRef.current;
    if (!node || !visible) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        setListHeight(e.contentRect.height);
      }
    });
    ro.observe(node);
    setListHeight(node.clientHeight);
    return () => ro.disconnect();
  }, [visible]);

  // Calculate visible thumbnail range from scroll position
  const visibleRange = useMemo(() => {
    if (totalPages === 0 || listHeight === 0) return { start: 1, end: 1 };

    const firstVisible =
      Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT)) + 1;
    const lastVisible = Math.min(
      totalPages,
      Math.ceil((scrollTop + listHeight) / ITEM_HEIGHT),
    );

    return {
      start: Math.max(1, firstVisible - OVERSCAN),
      end: Math.min(totalPages, lastVisible + OVERSCAN),
    };
  }, [scrollTop, totalPages, listHeight]);

  const handleScroll = useCallback(() => {
    const node = listRef.current;
    if (node) setScrollTop(node.scrollTop);
  }, []);

  // Auto-scroll sidebar to keep current page visible
  useEffect(() => {
    const node = listRef.current;
    if (!node || !visible || totalPages === 0) return;

    const itemTop = (currentPage - 1) * ITEM_HEIGHT;
    const itemBottom = itemTop + ITEM_HEIGHT;

    if (itemTop < node.scrollTop || itemBottom > node.scrollTop + listHeight) {
      node.scrollTo({
        top: itemTop - listHeight / 2 + ITEM_HEIGHT / 2,
        behavior: "smooth",
      });
    }
  }, [currentPage, visible, totalPages, listHeight]);

  // Build the list of thumbnails to render
  const thumbsToRender = useMemo(() => {
    const items: number[] = [];
    for (let i = visibleRange.start; i <= visibleRange.end; i++) {
      items.push(i);
    }
    return items;
  }, [visibleRange]);

  const totalListHeight = totalPages * ITEM_HEIGHT;

  if (!visible) return null;

  return (
    <div className={styles.sidebar}>
      <div className={styles.header}>
        <span className={styles.headerTitle}>Pages</span>
        {totalPages > 0 && (
          <span className={styles.headerCount}>{totalPages}</span>
        )}
      </div>

      <div
        className={styles.thumbnailList}
        ref={listRef}
        onScroll={handleScroll}
      >
        {fileUrl && totalPages > 0 && (
          <Document file={fileUrl} loading={null}>
            <div
              className={styles.virtualList}
              style={{ height: totalListHeight }}
            >
              {thumbsToRender.map((pageNum) => (
                <button
                  key={`thumb_${pageNum}`}
                  className={`${styles.thumbnailItem} ${
                    currentPage === pageNum ? styles.active : ""
                  }`}
                  onClick={() => onPageChange(pageNum)}
                  aria-label={`Go to page ${pageNum}`}
                  style={{
                    position: "absolute",
                    top: (pageNum - 1) * ITEM_HEIGHT,
                    left: 0,
                    right: 0,
                  }}
                >
                  <div className={styles.thumbnailCanvas}>
                    <Page
                      pageNumber={pageNum}
                      width={THUMB_WIDTH}
                      renderTextLayer={false}
                      renderAnnotationLayer={false}
                      loading={
                        <div className={styles.thumbPlaceholder}>
                          {pageNum}
                        </div>
                      }
                    />
                  </div>
                  <span className={styles.thumbnailLabel}>{pageNum}</span>
                </button>
              ))}
            </div>
          </Document>
        )}
      </div>
    </div>
  );
}
