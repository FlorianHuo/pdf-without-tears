import { useEffect, useRef, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { readFile } from "@tauri-apps/plugin-fs";
import { Document, Page } from "react-pdf";
import type { Book } from "../../types/book";
import { pdfDocumentOptions } from "../../utils/pdfSetup";
import styles from "./BookCard.module.css";

interface BookCardProps {
  book: Book;
  onOpen: (bookId: number) => void;
  onContextMenu?: (book: Book, x: number, y: number) => void;
}

export default function BookCard({ book, onOpen, onContextMenu }: BookCardProps) {
  const [thumbnailFailed, setThumbnailFailed] = useState(false);
  const progress =
    book.total_pages > 0 ? book.last_page / book.total_pages : 0;

  return (
    <div
      className={`${styles.card} ${book.is_archived ? styles.archived : ""}`}
      onClick={() => onOpen(book.id)}
      onContextMenu={(e) => {
        e.preventDefault();
        onContextMenu?.(book, e.clientX, e.clientY);
      }}
      title={book.title}
    >
      <div className={styles.cover}>
        {book.cover_thumb_path && !thumbnailFailed ? (
          <img
            className={styles.coverImage}
            src={convertFileSrc(book.cover_thumb_path)}
            alt={book.title}
            loading="lazy"
            onError={() => setThumbnailFailed(true)}
          />
        ) : (
          <PdfCoverPreview filePath={book.file_path} title={book.title} />
        )}
      </div>
      <div className={styles.info}>
        <span className={styles.title}>{book.title}</span>
        {book.author && (
          <span className={styles.author}>{book.author}</span>
        )}
        {book.status !== "unread" && (
          <span className={`${styles.statusBadge} ${styles[book.status]}`}>
            {book.status === "reading" ? "Reading" : "Finished"}
          </span>
        )}
      </div>
      {progress > 0 && progress < 1 && (
        <div className={styles.progressTrack}>
          <div
            className={styles.progressBar}
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}

interface PdfCoverPreviewProps {
  filePath: string;
  title: string;
}

function PdfCoverPreview({ filePath, title }: PdfCoverPreviewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) {
      return;
    }

    const updateWidth = () => {
      setWidth(node.clientWidth);
    };

    updateWidth();

    const observer = new ResizeObserver(updateWidth);
    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    void (async () => {
      try {
        const fileData = await readFile(filePath);
        if (cancelled) {
          return;
        }

        objectUrl = URL.createObjectURL(
          new Blob([fileData], { type: "application/pdf" }),
        );
        setPdfUrl(objectUrl);
      } catch (err) {
        console.error(`Failed to load cover preview for ${title}:`, err);
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [filePath, title]);

  return (
    <div ref={containerRef} className={styles.pdfPreview}>
      {pdfUrl && width > 0 ? (
        <Document
          file={pdfUrl}
          options={pdfDocumentOptions}
          loading={<div className={styles.placeholder}><PdfPlaceholderIcon /></div>}
          error={<div className={styles.placeholder}><PdfPlaceholderIcon /></div>}
        >
          <Page
            pageNumber={1}
            width={width}
            renderTextLayer={false}
            renderAnnotationLayer={false}
            loading={<div className={styles.placeholder}><PdfPlaceholderIcon /></div>}
          />
        </Document>
      ) : (
        <div className={styles.placeholder}>
          <PdfPlaceholderIcon />
        </div>
      )}
    </div>
  );
}

function PdfPlaceholderIcon() {
  return (
    <svg
      width="32"
      height="32"
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
  );
}
