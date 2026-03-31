import { useEffect, useRef, useState } from "react";
import type { Book, BookStatus } from "../../types/book";
import styles from "./BookContextMenu.module.css";

export interface ContextMenuAction {
  kind:
    | "open"
    | "edit"
    | "archive"
    | "unarchive"
    | "status"
    | "delete";
  book: Book;
  status?: BookStatus;
}

interface BookContextMenuProps {
  book: Book;
  x: number;
  y: number;
  onAction: (action: ContextMenuAction) => void;
  onClose: () => void;
}

export default function BookContextMenu({
  book,
  x,
  y,
  onAction,
  onClose,
}: BookContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [statusOpen, setStatusOpen] = useState(false);

  // Close on outside click or Escape
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", keyHandler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", keyHandler);
    };
  }, [onClose]);

  // Adjust position to stay within viewport
  const adjustedStyle: React.CSSProperties = {
    left: Math.min(x, window.innerWidth - 200),
    top: Math.min(y, window.innerHeight - 300),
  };

  const statusLabels: { value: BookStatus; label: string }[] = [
    { value: "unread", label: "📕 Unread" },
    { value: "reading", label: "📖 Reading" },
    { value: "finished", label: "📗 Finished" },
  ];

  return (
    <div
      ref={menuRef}
      className={styles.menu}
      style={adjustedStyle}
    >
      <button
        className={styles.item}
        onClick={() => onAction({ kind: "open", book })}
      >
        Open
      </button>

      <button
        className={styles.item}
        onClick={() => onAction({ kind: "edit", book })}
      >
        Edit Details…
      </button>

      <div className={styles.separator} />

      {/* Status sub-menu */}
      <div className={styles.submenuWrapper}>
        <button
          className={styles.item}
          onClick={() => setStatusOpen(!statusOpen)}
        >
          Status ›
        </button>
        {statusOpen && (
          <div className={styles.submenu}>
            {statusLabels.map(({ value, label }) => (
              <button
                key={value}
                className={`${styles.item} ${book.status === value ? styles.active : ""}`}
                onClick={() =>
                  onAction({ kind: "status", book, status: value })
                }
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {book.is_archived ? (
        <button
          className={styles.item}
          onClick={() => onAction({ kind: "unarchive", book })}
        >
          Unarchive
        </button>
      ) : (
        <button
          className={styles.item}
          onClick={() => onAction({ kind: "archive", book })}
        >
          Archive
        </button>
      )}

      <div className={styles.separator} />

      <button
        className={`${styles.item} ${styles.danger}`}
        onClick={() => onAction({ kind: "delete", book })}
      >
        Delete…
      </button>
    </div>
  );
}
