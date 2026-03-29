import styles from "./Toolbar.module.css";

interface ToolbarProps {
  currentPage: number;
  totalPages: number;
  zoom: number;
  hasDocument: boolean;
  sidebarVisible: boolean;
  onOpenFile: () => void;
  onPageChange: (page: number) => void;
  onZoomChange: (zoom: number) => void;
  onToggleSidebar: () => void;
  onToggleTheme: () => void;
  isDark: boolean;
}

// Zoom presets
const ZOOM_MIN = 0.25;
const ZOOM_MAX = 5.0;
const ZOOM_STEP = 0.25;

export default function Toolbar({
  currentPage,
  totalPages,
  zoom,
  hasDocument,
  sidebarVisible,
  onOpenFile,
  onPageChange,
  onZoomChange,
  onToggleSidebar,
  onToggleTheme,
  isDark,
}: ToolbarProps) {
  const handlePageInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      const target = e.target as HTMLInputElement;
      const page = parseInt(target.value);
      if (!isNaN(page) && page >= 1 && page <= totalPages) {
        onPageChange(page);
      } else {
        target.value = String(currentPage);
      }
    }
  };

  const handleZoomIn = () => {
    onZoomChange(Math.min(ZOOM_MAX, zoom + ZOOM_STEP));
  };

  const handleZoomOut = () => {
    onZoomChange(Math.max(ZOOM_MIN, zoom - ZOOM_STEP));
  };

  const handleFitWidth = () => {
    onZoomChange(1.0);
  };

  return (
    <div className={styles.toolbar}>
      {/* Left section */}
      <div className={styles.section}>
        <button
          className={styles.iconButton}
          onClick={onToggleSidebar}
          title={sidebarVisible ? "Hide sidebar" : "Show sidebar"}
          aria-label="Toggle sidebar"
        >
          <SidebarIcon />
        </button>

        <div className={styles.divider} />

        <button
          className={styles.iconButton}
          onClick={onOpenFile}
          title="Open PDF (Cmd+O)"
          aria-label="Open file"
        >
          <FolderIcon />
        </button>
      </div>

      {/* Center section - Navigation */}
      {hasDocument && (
        <div className={styles.section}>
          <button
            className={styles.iconButton}
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage <= 1}
            title="Previous page"
            aria-label="Previous page"
          >
            <ChevronUpIcon />
          </button>

          <div className={styles.pageIndicator}>
            <input
              className={styles.pageInput}
              type="text"
              defaultValue={currentPage}
              key={currentPage}
              onKeyDown={handlePageInput}
              onFocus={(e) => e.target.select()}
              aria-label="Current page"
            />
            <span className={styles.pageSeparator}>/</span>
            <span className={styles.pageTotal}>{totalPages}</span>
          </div>

          <button
            className={styles.iconButton}
            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage >= totalPages}
            title="Next page"
            aria-label="Next page"
          >
            <ChevronDownIcon />
          </button>
        </div>
      )}

      {/* Right section - Zoom & Theme */}
      <div className={styles.section}>
        {hasDocument && (
          <>
            <button
              className={styles.iconButton}
              onClick={handleZoomOut}
              disabled={zoom <= ZOOM_MIN}
              title="Zoom out"
              aria-label="Zoom out"
            >
              <MinusIcon />
            </button>

            <button
              className={styles.zoomButton}
              onClick={handleFitWidth}
              title="Reset zoom to fit width"
              aria-label="Zoom level"
            >
              {Math.round(zoom * 100)}%
            </button>

            <button
              className={styles.iconButton}
              onClick={handleZoomIn}
              disabled={zoom >= ZOOM_MAX}
              title="Zoom in"
              aria-label="Zoom in"
            >
              <PlusIcon />
            </button>

            <div className={styles.divider} />
          </>
        )}

        <button
          className={styles.iconButton}
          onClick={onToggleTheme}
          title={isDark ? "Switch to light mode" : "Switch to dark mode"}
          aria-label="Toggle theme"
        >
          {isDark ? <SunIcon /> : <MoonIcon />}
        </button>
      </div>
    </div>
  );
}

/* ============================================================
   Inline SVG Icons (lightweight, no dependency needed)
   ============================================================ */

function SidebarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="2" width="14" height="12" rx="2" />
      <line x1="5.5" y1="2" x2="5.5" y2="14" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 4.5V12a1.5 1.5 0 001.5 1.5h9A1.5 1.5 0 0014 12V6a1.5 1.5 0 00-1.5-1.5H8L6.5 3H3.5A1.5 1.5 0 002 4.5z" />
    </svg>
  );
}

function ChevronUpIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4,10 8,6 12,10" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4,6 8,10 12,6" />
    </svg>
  );
}

function MinusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <line x1="4" y1="8" x2="12" y2="8" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <line x1="8" y1="4" x2="8" y2="12" />
      <line x1="4" y1="8" x2="12" y2="8" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="8" cy="8" r="3" />
      <line x1="8" y1="1.5" x2="8" y2="3" />
      <line x1="8" y1="13" x2="8" y2="14.5" />
      <line x1="1.5" y1="8" x2="3" y2="8" />
      <line x1="13" y1="8" x2="14.5" y2="8" />
      <line x1="3.4" y1="3.4" x2="4.5" y2="4.5" />
      <line x1="11.5" y1="11.5" x2="12.6" y2="12.6" />
      <line x1="3.4" y1="12.6" x2="4.5" y2="11.5" />
      <line x1="11.5" y1="4.5" x2="12.6" y2="3.4" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13.5 8.5a5.5 5.5 0 01-7-7 5.5 5.5 0 107 7z" />
    </svg>
  );
}
