import type { Book } from "../../types/book";
import BookCard from "../BookCard/BookCard";
import styles from "./LibraryView.module.css";

interface LibraryViewProps {
  onOpenBook: (bookId: number) => void;
  onImport: () => void;
  isDragging: boolean;
  books: Book[];
  importing: boolean;
}

export default function LibraryView({
  onOpenBook,
  onImport,
  isDragging,
  books,
  importing,
}: LibraryViewProps) {

  // Empty state
  if (books.length === 0 && !importing) {
    return (
      <div
        className={`${styles.empty} ${isDragging ? styles.dragging : ""}`}
      >
        <div className={styles.emptyContent}>
          <div className={styles.hero}>
            <div className={styles.logoMark}>
              <svg
                width="48"
                height="48"
                viewBox="0 0 48 48"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="8" y="4" width="32" height="40" rx="3" />
                <line x1="14" y1="14" x2="34" y2="14" />
                <line x1="14" y1="20" x2="34" y2="20" />
                <line x1="14" y1="26" x2="28" y2="26" />
                <line x1="14" y1="32" x2="22" y2="32" />
              </svg>
            </div>
            <h1 className={styles.title}>PDF Without Tears</h1>
            <p className={styles.subtitle}>
              Your personal PDF library
            </p>
          </div>

          <div className={styles.dropZone} onClick={onImport}>
            <div className={styles.dropIcon}>
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="17,8 12,3 7,8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <span className={styles.dropText}>
              Drop PDFs here, or click to import
            </span>
            <span className={styles.dropHint}>Cmd + O</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.container} ${isDragging ? styles.dragging : ""}`}>
      {importing && (
        <div className={styles.importingBanner}>Importing...</div>
      )}
      <div className={styles.grid}>
        {books.map((book) => (
          <BookCard key={book.id} book={book} onOpen={onOpenBook} />
        ))}
      </div>
    </div>
  );
}
