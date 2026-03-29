import { Document, Page, pdfjs } from "react-pdf";
import styles from "./Sidebar.module.css";

interface SidebarProps {
  visible: boolean;
  fileUrl: string | null;
  totalPages: number;
  currentPage: number;
  onPageChange: (page: number) => void;
}

export default function Sidebar({
  visible,
  fileUrl,
  totalPages,
  currentPage,
  onPageChange,
}: SidebarProps) {
  if (!visible) return null;

  return (
    <div className={styles.sidebar}>
      <div className={styles.header}>
        <span className={styles.headerTitle}>Pages</span>
        {totalPages > 0 && (
          <span className={styles.headerCount}>{totalPages}</span>
        )}
      </div>

      <div className={styles.thumbnailList}>
        {fileUrl &&
          Array.from(new Array(totalPages), (_, index) => (
            <button
              key={`thumb_${index + 1}`}
              className={`${styles.thumbnailItem} ${
                currentPage === index + 1 ? styles.active : ""
              }`}
              onClick={() => onPageChange(index + 1)}
              aria-label={`Go to page ${index + 1}`}
            >
              <div className={styles.thumbnailCanvas}>
                <Document file={fileUrl}>
                  <Page
                    pageNumber={index + 1}
                    width={150}
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                  />
                </Document>
              </div>
              <span className={styles.thumbnailLabel}>{index + 1}</span>
            </button>
          ))}
      </div>
    </div>
  );
}
