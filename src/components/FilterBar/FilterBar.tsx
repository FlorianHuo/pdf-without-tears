import type { BookStatus } from "../../types/book";
import styles from "./FilterBar.module.css";

interface FilterBarProps {
  /** Active search query (displayed as a chip when non-empty). */
  searchQuery: string;
  /** Active tag filters. */
  activeTags: string[];
  /** Active category filter. */
  activeCategory: string;
  /** Active status filter. */
  activeStatus: BookStatus | "";
  /** Whether we are viewing archived books. */
  showArchived: boolean;
  /** All tags in the library for the picker. */
  allTags: string[];
  /** All categories in the library. */
  allCategories: string[];
  onSearchChange: (q: string) => void;
  onTagToggle: (tag: string) => void;
  onCategoryChange: (cat: string) => void;
  onStatusChange: (status: BookStatus | "") => void;
  onArchiveToggle: () => void;
  onClearAll: () => void;
}

export default function FilterBar({
  searchQuery,
  activeTags,
  activeCategory,
  activeStatus,
  showArchived,
  allTags,
  allCategories,
  onSearchChange,
  onTagToggle,
  onCategoryChange,
  onStatusChange,
  onArchiveToggle,
  onClearAll,
}: FilterBarProps) {
  const hasFilters =
    searchQuery || activeTags.length > 0 || activeCategory || activeStatus;

  return (
    <div className={styles.bar}>
      {/* Search */}
      <div className={styles.searchBox}>
        <SearchIcon />
        <input
          className={styles.searchInput}
          type="text"
          placeholder="Search books…"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
        {searchQuery && (
          <button
            className={styles.clearBtn}
            onClick={() => onSearchChange("")}
          >
            ×
          </button>
        )}
      </div>

      {/* Status filter */}
      <select
        className={styles.filterSelect}
        value={activeStatus}
        onChange={(e) => onStatusChange(e.target.value as BookStatus | "")}
      >
        <option value="">All status</option>
        <option value="unread">Unread</option>
        <option value="reading">Reading</option>
        <option value="finished">Finished</option>
      </select>

      {/* Category filter */}
      {allCategories.length > 0 && (
        <select
          className={styles.filterSelect}
          value={activeCategory}
          onChange={(e) => onCategoryChange(e.target.value)}
        >
          <option value="">All categories</option>
          {allCategories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      )}

      {/* Tag pills */}
      {allTags.length > 0 && (
        <div className={styles.tags}>
          {allTags.map((tag) => (
            <button
              key={tag}
              className={`${styles.tagPill} ${activeTags.includes(tag) ? styles.tagActive : ""}`}
              onClick={() => onTagToggle(tag)}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* Archive toggle */}
      <button
        className={`${styles.archiveBtn} ${showArchived ? styles.archiveActive : ""}`}
        onClick={onArchiveToggle}
        title={showArchived ? "Viewing archived" : "Show archived"}
      >
        <ArchiveIcon />
      </button>

      {/* Clear all */}
      {hasFilters && (
        <button className={styles.clearAllBtn} onClick={onClearAll}>
          Clear
        </button>
      )}
    </div>
  );
}

function SearchIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    >
      <circle cx="7" cy="7" r="5" />
      <line x1="11" y1="11" x2="14" y2="14" />
    </svg>
  );
}

function ArchiveIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="1" y="2" width="14" height="4" rx="1" />
      <path d="M2 6v7a1 1 0 001 1h10a1 1 0 001-1V6" />
      <path d="M6 9h4" />
    </svg>
  );
}
