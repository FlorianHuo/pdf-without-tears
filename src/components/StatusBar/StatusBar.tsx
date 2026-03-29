import styles from "./StatusBar.module.css";

interface StatusBarProps {
  currentPage: number;
  totalPages: number;
  zoom: number;
  fileName: string | null;
}

export default function StatusBar({
  currentPage,
  totalPages,
  zoom,
  fileName,
}: StatusBarProps) {
  return (
    <div className={styles.statusBar}>
      <div className={styles.left}>
        {fileName && (
          <span className={styles.fileName} title={fileName}>
            {fileName}
          </span>
        )}
      </div>
      <div className={styles.right}>
        {totalPages > 0 && (
          <>
            <span className={styles.info}>
              Page {currentPage} of {totalPages}
            </span>
            <span className={styles.separator}>|</span>
            <span className={styles.info}>{Math.round(zoom * 100)}%</span>
          </>
        )}
      </div>
    </div>
  );
}
