import styles from "./ConfirmDialog.module.css";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  /** Optional extra content (e.g. a checkbox) rendered below the message. */
  children?: React.ReactNode;
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  onConfirm,
  onCancel,
  children,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <h3 className={styles.title}>{title}</h3>
        <p className={styles.message}>{message}</p>
        {children && <div className={styles.extra}>{children}</div>}
        <div className={styles.actions}>
          <button className={styles.cancelBtn} onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            className={`${styles.confirmBtn} ${danger ? styles.danger : ""}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
