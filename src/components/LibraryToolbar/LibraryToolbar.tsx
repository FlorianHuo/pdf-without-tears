import type { SortField, SortDirection } from "../../types/book";
import styles from "./LibraryToolbar.module.css";

interface LibraryToolbarProps {
  onImport: () => void;
  onBatchImport: () => void;
  onOpenSettings: () => void;
  onToggleTheme: () => void;
  isDark: boolean;
  bookCount: number;
  sortField: SortField;
  sortDirection: SortDirection;
  onSortChange: (field: SortField, direction: SortDirection) => void;
}

export default function LibraryToolbar({
  onImport,
  onBatchImport,
  onOpenSettings,
  onToggleTheme,
  isDark,
  bookCount,
  sortField,
  sortDirection,
  onSortChange,
}: LibraryToolbarProps) {
  return (
    <div className={styles.toolbar}>
      {/* Left - App title */}
      <div className={styles.section}>
        <span className={styles.appTitle}>PDF Without Tears</span>
        {bookCount > 0 && (
          <span className={styles.bookCount}>{bookCount} books</span>
        )}
      </div>

      {/* Right - Actions */}
      <div className={styles.section}>
        <button
          className={styles.importButton}
          onClick={onImport}
          title="Import PDFs"
          aria-label="Import PDFs"
        >
          <PlusIcon />
          <span>Import</span>
        </button>

        <button
          className={styles.importButton}
          onClick={onBatchImport}
          title="Import from folder"
          aria-label="Import from folder"
        >
          <FolderIcon />
          <span>Folder</span>
        </button>

        <div className={styles.divider} />

        <select
          className={styles.sortSelect}
          value={`${sortField}:${sortDirection}`}
          onChange={(e) => {
            const [f, d] = e.target.value.split(":");
            onSortChange(f as SortField, d as SortDirection);
          }}
          title="Sort books"
        >
          <option value="last_opened_at:desc">Recent</option>
          <option value="added_at:desc">Newest</option>
          <option value="title:asc">Title A–Z</option>
          <option value="title:desc">Title Z–A</option>
          <option value="author:asc">Author A–Z</option>
        </select>

        <div className={styles.divider} />

        <button
          className={styles.iconButton}
          onClick={onOpenSettings}
          title="Settings"
          aria-label="Settings"
        >
          <GearIcon />
        </button>

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

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <line x1="8" y1="4" x2="8" y2="12" />
      <line x1="4" y1="8" x2="12" y2="8" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="2.5" />
      <path d="M13.3 10a1.1 1.1 0 00.2 1.2l.04.04a1.33 1.33 0 11-1.88 1.88l-.04-.04a1.1 1.1 0 00-1.2-.2 1.1 1.1 0 00-.67 1.01v.12a1.33 1.33 0 11-2.67 0v-.06a1.1 1.1 0 00-.72-1.01 1.1 1.1 0 00-1.2.2l-.04.04a1.33 1.33 0 11-1.88-1.88l.04-.04a1.1 1.1 0 00.2-1.2 1.1 1.1 0 00-1.01-.67h-.12a1.33 1.33 0 110-2.67h.06a1.1 1.1 0 001.01-.72 1.1 1.1 0 00-.2-1.2l-.04-.04A1.33 1.33 0 114.88 2.92l.04.04a1.1 1.1 0 001.2.2h.05a1.1 1.1 0 00.67-1.01v-.12a1.33 1.33 0 112.67 0v.06a1.1 1.1 0 00.67 1.01 1.1 1.1 0 001.2-.2l.04-.04a1.33 1.33 0 111.88 1.88l-.04.04a1.1 1.1 0 00-.2 1.2v.05a1.1 1.1 0 001.01.67h.12a1.33 1.33 0 010 2.67h-.06a1.1 1.1 0 00-1.01.67z" />
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

function FolderIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 4a1 1 0 011-1h3.586a1 1 0 01.707.293L8.5 4.5H13a1 1 0 011 1V12a1 1 0 01-1 1H3a1 1 0 01-1-1V4z" />
    </svg>
  );
}
