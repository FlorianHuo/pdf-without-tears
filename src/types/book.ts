/** Reading status of a book. */
export type BookStatus = "unread" | "reading" | "finished";

/** Fields that can be used for sorting. */
export type SortField =
  | "title"
  | "author"
  | "added_at"
  | "last_opened_at"
  | "sort_order";

/** Sort direction. */
export type SortDirection = "asc" | "desc";

export interface Book {
  id: number;
  title: string;
  author: string;
  file_path: string;
  is_copied: boolean;
  cover_thumb_path: string | null;
  tags: string[];
  category: string;
  last_page: number;
  total_pages: number;
  added_at: string;
  last_opened_at: string;
  /** Current reading status. */
  status: BookStatus;
  /** Whether the book has been archived (hidden from main view). */
  is_archived: boolean;
  /** Manual sort order — lower comes first. */
  sort_order: number;
}

/** Declarative filter passed to the data layer. */
export interface BookFilter {
  search?: string;
  tags?: string[];
  category?: string;
  status?: BookStatus;
  isArchived?: boolean;
}

/** Declarative sort spec passed to the data layer. */
export interface BookSort {
  field: SortField;
  direction: SortDirection;
}
