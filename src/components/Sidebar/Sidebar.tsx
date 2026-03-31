import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { Document, Page } from "react-pdf";
import TocPanel from "../TocPanel/TocPanel";
import type { TocItem } from "../../types/toc";
import type { AiTocProgress } from "../../utils/aiTocGenerator";
import { pdfDocumentOptions } from "../../utils/pdfSetup";
import styles from "./Sidebar.module.css";

type SidebarTab = "pages" | "outline";

interface SidebarProps {
  visible: boolean;
  fileUrl: string | null;
  totalPages: number;
  currentPage: number;
  tocItems: TocItem[];
  onPageChange: (page: number) => void;
  onTocUpdate: (items: TocItem[]) => void;
  onAiGenerate?: () => void;
  onAiCancel?: () => void;
  aiProgress?: AiTocProgress | null;
  width?: number;
}

// Thumbnail dimensions
const THUMB_WIDTH = 150;
const THUMB_HEIGHT = Math.round(THUMB_WIDTH * 1.55);
const ITEM_GAP = 8;
const ITEM_PADDING = 8;
const LABEL_HEIGHT = 18;
const ITEM_HEIGHT = THUMB_HEIGHT + ITEM_PADDING * 2 + LABEL_HEIGHT + ITEM_GAP;
const OVERSCAN = 3;

export default function Sidebar({
  visible,
  fileUrl,
  totalPages,
  currentPage,
  tocItems,
  onPageChange,
  onTocUpdate,
  onAiGenerate,
  onAiCancel,
  aiProgress,
  width,
}: SidebarProps) {
  // Default to "outline" tab if the PDF has an outline, otherwise "pages"
  const [activeTab, setActiveTab] = useState<SidebarTab>(
    tocItems.length > 0 ? "outline" : "pages",
  );

  // Switch to outline tab when TOC is first loaded
  useEffect(() => {
    if (tocItems.length > 0) {
      setActiveTab("outline");
    }
  }, [tocItems.length > 0]);

  if (!visible) return null;

  return (
    <div className={styles.sidebar} style={width ? { width, minWidth: width } : undefined}>
      {/* Tab bar */}
      <div className={styles.tabBar}>
        <button
          className={`${styles.tab} ${activeTab === "outline" ? styles.activeTab : ""}`}
          onClick={() => setActiveTab("outline")}
        >
          Outline
        </button>
        <button
          className={`${styles.tab} ${activeTab === "pages" ? styles.activeTab : ""}`}
          onClick={() => setActiveTab("pages")}
        >
          Pages
          {totalPages > 0 && (
            <span className={styles.tabBadge}>{totalPages}</span>
          )}
        </button>
      </div>

      {/* Tab content */}
      {activeTab === "pages" ? (
        <PageThumbnails
          fileUrl={fileUrl}
          totalPages={totalPages}
          currentPage={currentPage}
          onPageChange={onPageChange}
        />
      ) : (
        <TocPanel
          items={tocItems}
          currentPage={currentPage}
          onNavigate={onPageChange}
          onUpdate={onTocUpdate}
          onAiGenerate={onAiGenerate}
          onAiCancel={onAiCancel}
          aiProgress={aiProgress}
        />
      )}
    </div>
  );
}

// ---- Page Thumbnails sub-component (extracted from old Sidebar) ----

interface PageThumbnailsProps {
  fileUrl: string | null;
  totalPages: number;
  currentPage: number;
  onPageChange: (page: number) => void;
}

function PageThumbnails({
  fileUrl,
  totalPages,
  currentPage,
  onPageChange,
}: PageThumbnailsProps) {
  const listRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [listHeight, setListHeight] = useState(0);

  useEffect(() => {
    const node = listRef.current;
    if (!node) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        setListHeight(e.contentRect.height);
      }
    });
    ro.observe(node);
    setListHeight(node.clientHeight);
    return () => ro.disconnect();
  }, []);

  const visibleRange = useMemo(() => {
    if (totalPages === 0 || listHeight === 0) return { start: 1, end: 1 };
    const firstVisible = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT)) + 1;
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

  useEffect(() => {
    const node = listRef.current;
    if (!node || totalPages === 0) return;
    const itemTop = (currentPage - 1) * ITEM_HEIGHT;
    const itemBottom = itemTop + ITEM_HEIGHT;
    if (itemTop < node.scrollTop || itemBottom > node.scrollTop + listHeight) {
      node.scrollTo({
        top: itemTop - listHeight / 2 + ITEM_HEIGHT / 2,
        behavior: "smooth",
      });
    }
  }, [currentPage, totalPages, listHeight]);

  const thumbsToRender = useMemo(() => {
    const items: number[] = [];
    for (let i = visibleRange.start; i <= visibleRange.end; i++) {
      items.push(i);
    }
    return items;
  }, [visibleRange]);

  const totalListHeight = totalPages * ITEM_HEIGHT;

  return (
    <div
      className={styles.thumbnailList}
      ref={listRef}
      onScroll={handleScroll}
    >
      {fileUrl && totalPages > 0 && (
        <Document file={fileUrl} options={pdfDocumentOptions} loading={null}>
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
  );
}
