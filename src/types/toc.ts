// TOC (Table of Contents) data model for PDF outlines/bookmarks

export interface TocItem {
  /** Unique identifier for React keys and editing operations */
  id: string;
  /** Display text for this bookmark entry */
  title: string;
  /** Target page number (1-indexed) */
  pageNumber: number;
  /** Nesting depth: 0 = top-level chapter, 1 = section, 2 = subsection, etc. */
  depth: number;
  /** Nested child entries */
  children: TocItem[];
  /** Whether children are collapsed in the UI */
  collapsed?: boolean;
}

/**
 * Generate a unique ID for a new TocItem.
 * Uses a simple counter + timestamp to avoid collisions.
 */
let _idCounter = 0;
export function generateTocId(): string {
  return `toc_${Date.now()}_${_idCounter++}`;
}
