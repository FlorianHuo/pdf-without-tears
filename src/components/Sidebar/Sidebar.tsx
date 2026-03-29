import { useEffect, useRef, useState, useCallback } from "react";
import { Document, Page } from "react-pdf";
import styles from "./Sidebar.module.css";

interface SidebarProps {
  visible: boolean;
  fileUrl: string | null;
  totalPages: number;
  currentPage: number;
  onPageChange: (page: number) => void;
}

// Only render thumbnails that are in/near the visible area
const THUMB_BUFFER = 5;

export default function Sidebar({
  visible,
  fileUrl,
  totalPages,
  currentPage,
  onPageChange,
}: SidebarProps) {
  const listRef = useRef<HTMLDivElement | null>(null);
  const [visibleThumbs, setVisibleThumbs] = useState<Set<number>>(
    new Set([1, 2, 3, 4, 5]),
  );
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Setup IntersectionObserver for thumbnails
  const setupObserver = useCallback(() => {
    if (observerRef.current) observerRef.current.disconnect();

    const list = listRef.current;
    if (!list) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        setVisibleThumbs((prev) => {
          const next = new Set(prev);
          for (const entry of entries) {
            const idx = parseInt(
              entry.target.getAttribute("data-thumb") || "0",
            );
            if (idx === 0) continue;
            if (entry.isIntersecting) {
              next.add(idx);
            } else {
              next.delete(idx);
            }
          }
          return next;
        });
      },
      {
        root: list,
        rootMargin: "200px 0px 200px 0px",
        threshold: 0,
      },
    );

    const items = list.querySelectorAll("[data-thumb]");
    items.forEach((el) => observerRef.current!.observe(el));
  }, []);

  // Re-observe when totalPages changes
  useEffect(() => {
    if (totalPages > 0 && visible) {
      requestAnimationFrame(() => setupObserver());
    }
    return () => {
      if (observerRef.current) observerRef.current.disconnect();
    };
  }, [totalPages, visible, setupObserver]);

  // Auto-scroll the sidebar to keep the current page thumbnail visible
  useEffect(() => {
    if (!visible || !listRef.current) return;

    const activeThumb = listRef.current.querySelector(
      `[data-thumb="${currentPage}"]`,
    );
    if (activeThumb) {
      activeThumb.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [currentPage, visible]);

  // Determine which thumbnails to actually render
  const renderedThumbs = new Set<number>();
  for (const p of visibleThumbs) {
    for (
      let i = Math.max(1, p - THUMB_BUFFER);
      i <= Math.min(totalPages, p + THUMB_BUFFER);
      i++
    ) {
      renderedThumbs.add(i);
    }
  }

  if (!visible) return null;

  return (
    <div className={styles.sidebar}>
      <div className={styles.header}>
        <span className={styles.headerTitle}>Pages</span>
        {totalPages > 0 && (
          <span className={styles.headerCount}>{totalPages}</span>
        )}
      </div>

      <div className={styles.thumbnailList} ref={listRef}>
        {fileUrl && totalPages > 0 && (
          <Document file={fileUrl} loading={null}>
            {Array.from(new Array(totalPages), (_, index) => {
              const pageNum = index + 1;
              const shouldRender = renderedThumbs.has(pageNum);

              return (
                <button
                  key={`thumb_${pageNum}`}
                  className={`${styles.thumbnailItem} ${
                    currentPage === pageNum ? styles.active : ""
                  }`}
                  onClick={() => onPageChange(pageNum)}
                  aria-label={`Go to page ${pageNum}`}
                  data-thumb={pageNum}
                >
                  <div className={styles.thumbnailCanvas}>
                    {shouldRender ? (
                      <Page
                        pageNumber={pageNum}
                        width={150}
                        renderTextLayer={false}
                        renderAnnotationLayer={false}
                        loading={
                          <div className={styles.thumbPlaceholder}>
                            {pageNum}
                          </div>
                        }
                      />
                    ) : (
                      <div className={styles.thumbPlaceholder}>{pageNum}</div>
                    )}
                  </div>
                  <span className={styles.thumbnailLabel}>{pageNum}</span>
                </button>
              );
            })}
          </Document>
        )}
      </div>
    </div>
  );
}
