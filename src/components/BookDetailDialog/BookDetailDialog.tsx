import { useState, useRef, useEffect } from "react";
import type { Book, BookStatus } from "../../types/book";
import styles from "./BookDetailDialog.module.css";

interface BookDetailDialogProps {
  open: boolean;
  book: Book | null;
  allTags: string[];
  allCategories: string[];
  onSave: (
    bookId: number,
    fields: {
      title: string;
      author: string;
      tags: string[];
      category: string;
      status: BookStatus;
    },
  ) => void;
  onClose: () => void;
}

export default function BookDetailDialog({
  open,
  book,
  allTags,
  allCategories,
  onSave,
  onClose,
}: BookDetailDialogProps) {
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState<BookStatus>("unread");
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && book) {
      setTitle(book.title);
      setAuthor(book.author);
      setTags([...book.tags]);
      setCategory(book.category);
      setStatus(book.status);
      setTimeout(() => titleRef.current?.focus(), 50);
    }
  }, [open, book]);

  if (!open || !book) return null;

  const handleAddTag = () => {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) {
      setTags([...tags, t]);
    }
    setTagInput("");
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const handleSave = () => {
    onSave(book.id, { title, author, tags, category, status });
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    }
  };

  // Suggest tags not yet applied
  const tagSuggestions = allTags.filter(
    (t) => !tags.includes(t) && t.toLowerCase().includes(tagInput.toLowerCase()),
  );

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={styles.dialog}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className={styles.header}>
          <h3 className={styles.headerTitle}>Edit Book</h3>
          <button className={styles.closeBtn} onClick={onClose}>
            &times;
          </button>
        </div>

        <div className={styles.body}>
          {/* Title */}
          <div className={styles.field}>
            <label className={styles.label}>Title</label>
            <input
              ref={titleRef}
              className={styles.input}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              spellCheck={false}
            />
          </div>

          {/* Author */}
          <div className={styles.field}>
            <label className={styles.label}>Author</label>
            <input
              className={styles.input}
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              spellCheck={false}
            />
          </div>

          {/* Category */}
          <div className={styles.field}>
            <label className={styles.label}>Category</label>
            <input
              className={styles.input}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. Mathematics"
              list="category-suggestions"
              spellCheck={false}
            />
            {allCategories.length > 0 && (
              <datalist id="category-suggestions">
                {allCategories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            )}
          </div>

          {/* Status */}
          <div className={styles.field}>
            <label className={styles.label}>Status</label>
            <select
              className={styles.select}
              value={status}
              onChange={(e) => setStatus(e.target.value as BookStatus)}
            >
              <option value="unread">Unread</option>
              <option value="reading">Reading</option>
              <option value="finished">Finished</option>
            </select>
          </div>

          {/* Tags */}
          <div className={styles.field}>
            <label className={styles.label}>Tags</label>
            <div className={styles.tagList}>
              {tags.map((tag) => (
                <span key={tag} className={styles.tag}>
                  {tag}
                  <button
                    className={styles.tagRemove}
                    onClick={() => handleRemoveTag(tag)}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <div className={styles.tagInputRow}>
              <input
                className={styles.input}
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                placeholder="Add tag…"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    e.stopPropagation();
                    handleAddTag();
                  }
                }}
              />
              <button className={styles.addTagBtn} onClick={handleAddTag}>
                +
              </button>
            </div>
            {tagInput && tagSuggestions.length > 0 && (
              <div className={styles.suggestions}>
                {tagSuggestions.slice(0, 6).map((s) => (
                  <button
                    key={s}
                    className={styles.suggestion}
                    onClick={() => {
                      setTags([...tags, s]);
                      setTagInput("");
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={onClose}>
            Cancel
          </button>
          <button className={styles.saveBtn} onClick={handleSave}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
