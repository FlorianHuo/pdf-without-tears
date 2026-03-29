import { useState, useRef, useCallback } from "react";
import type { TocItem } from "../../types/toc";
import { generateTocId } from "../../types/toc";
import styles from "./TocPanel.module.css";

interface TocPanelProps {
  items: TocItem[];
  currentPage: number;
  onNavigate: (page: number) => void;
  onUpdate: (items: TocItem[]) => void;
}

export default function TocPanel({
  items,
  currentPage,
  onNavigate,
  onUpdate,
}: TocPanelProps) {
  const [editingId, setEditingId] = useState<string | null>(null);

  // Find the TOC entry closest to (but not after) the current page
  const activeId = findActiveTocId(items, currentPage);

  // ---- Edit operations ----

  const handleRename = useCallback(
    (id: string, newTitle: string) => {
      onUpdate(updateItemInTree(items, id, (item) => ({ ...item, title: newTitle })));
      setEditingId(null);
    },
    [items, onUpdate],
  );

  const handleDelete = useCallback(
    (id: string) => {
      onUpdate(removeItemFromTree(items, id));
    },
    [items, onUpdate],
  );

  const handleAddAfter = useCallback(
    (id: string, depth: number) => {
      const newItem: TocItem = {
        id: generateTocId(),
        title: "New Entry",
        pageNumber: currentPage,
        depth,
        children: [],
      };
      onUpdate(insertAfterInTree(items, id, newItem));
      // Start editing the new item immediately
      setEditingId(newItem.id);
    },
    [items, onUpdate, currentPage],
  );

  const handleAddChild = useCallback(
    (id: string, depth: number) => {
      const newItem: TocItem = {
        id: generateTocId(),
        title: "New Entry",
        pageNumber: currentPage,
        depth: depth + 1,
        children: [],
      };
      onUpdate(addChildInTree(items, id, newItem));
      setEditingId(newItem.id);
    },
    [items, onUpdate, currentPage],
  );

  const handlePageNumberChange = useCallback(
    (id: string, pageNumber: number) => {
      onUpdate(
        updateItemInTree(items, id, (item) => ({ ...item, pageNumber })),
      );
    },
    [items, onUpdate],
  );

  const handleToggleCollapse = useCallback(
    (id: string) => {
      onUpdate(
        updateItemInTree(items, id, (item) => ({
          ...item,
          collapsed: !item.collapsed,
        })),
      );
    },
    [items, onUpdate],
  );

  const handleIndent = useCallback(
    (id: string) => {
      onUpdate(indentItem(items, id));
    },
    [items, onUpdate],
  );

  const handleOutdent = useCallback(
    (id: string) => {
      onUpdate(outdentItem(items, id));
    },
    [items, onUpdate],
  );

  const handleAddRoot = useCallback(() => {
    const newItem: TocItem = {
      id: generateTocId(),
      title: "New Chapter",
      pageNumber: currentPage,
      depth: 0,
      children: [],
    };
    onUpdate([...items, newItem]);
    setEditingId(newItem.id);
  }, [items, onUpdate, currentPage]);

  if (items.length === 0) {
    return (
      <div className={styles.emptyState}>
        <span className={styles.emptyIcon}>📑</span>
        <p className={styles.emptyText}>No outline found</p>
        <button className={styles.addButton} onClick={handleAddRoot}>
          + Add first entry
        </button>
      </div>
    );
  }

  return (
    <div className={styles.tocPanel}>
      <div className={styles.tocList}>
        <TocTree
          items={items}
          activeId={activeId}
          editingId={editingId}
          onNavigate={onNavigate}
          onStartEdit={setEditingId}
          onRename={handleRename}
          onDelete={handleDelete}
          onAddAfter={handleAddAfter}
          onAddChild={handleAddChild}
          onPageNumberChange={handlePageNumberChange}
          onToggleCollapse={handleToggleCollapse}
          onIndent={handleIndent}
          onOutdent={handleOutdent}
        />
      </div>
      <div className={styles.tocFooter}>
        <button className={styles.addButton} onClick={handleAddRoot}>
          + Add entry
        </button>
      </div>
    </div>
  );
}

// ---- Tree rendering ----

interface TocTreeProps {
  items: TocItem[];
  activeId: string | null;
  editingId: string | null;
  onNavigate: (page: number) => void;
  onStartEdit: (id: string | null) => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onAddAfter: (id: string, depth: number) => void;
  onAddChild: (id: string, depth: number) => void;
  onPageNumberChange: (id: string, page: number) => void;
  onToggleCollapse: (id: string) => void;
  onIndent: (id: string) => void;
  onOutdent: (id: string) => void;
}

function TocTree({ items, ...props }: TocTreeProps) {
  return (
    <>
      {items.map((item) => (
        <TocItemRow key={item.id} item={item} {...props} />
      ))}
    </>
  );
}

interface TocItemRowProps extends Omit<TocTreeProps, "items"> {
  item: TocItem;
}

function TocItemRow({
  item,
  activeId,
  editingId,
  onNavigate,
  onStartEdit,
  onRename,
  onDelete,
  onAddAfter,
  onAddChild,
  onPageNumberChange,
  onToggleCollapse,
  onIndent,
  onOutdent,
}: TocItemRowProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isEditing = editingId === item.id;
  const isActive = activeId === item.id;
  const hasChildren = item.children.length > 0;
  const [showActions, setShowActions] = useState(false);

  const handleDoubleClick = () => {
    onStartEdit(item.id);
    // Focus the input after React renders it
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      onRename(item.id, (e.target as HTMLInputElement).value);
    } else if (e.key === "Escape") {
      onStartEdit(null);
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    onRename(item.id, e.target.value);
  };

  return (
    <>
      <div
        className={`${styles.tocItem} ${isActive ? styles.active : ""}`}
        style={{ paddingLeft: `${12 + item.depth * 16}px` }}
        onMouseEnter={() => setShowActions(true)}
        onMouseLeave={() => setShowActions(false)}
      >
        {/* Collapse toggle */}
        {hasChildren ? (
          <button
            className={styles.collapseButton}
            onClick={() => onToggleCollapse(item.id)}
            aria-label={item.collapsed ? "Expand" : "Collapse"}
          >
            <span
              className={`${styles.collapseIcon} ${item.collapsed ? styles.collapsed : ""}`}
            >
              ▸
            </span>
          </button>
        ) : (
          <span className={styles.collapseButton} />
        )}

        {/* Title */}
        {isEditing ? (
          <input
            ref={inputRef}
            className={styles.editInput}
            defaultValue={item.title}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            autoFocus
          />
        ) : (
          <span
            className={styles.tocTitle}
            onClick={() => onNavigate(item.pageNumber)}
            onDoubleClick={handleDoubleClick}
            title={`${item.title} (p.${item.pageNumber})`}
          >
            {item.title}
          </span>
        )}

        {/* Page number */}
        <span
          className={styles.pageNum}
          onClick={() => onNavigate(item.pageNumber)}
        >
          {item.pageNumber}
        </span>

        {/* Action buttons (show on hover) */}
        {showActions && !isEditing && (
          <div className={styles.actionBar}>
            <button
              className={styles.actionBtn}
              onClick={() => onAddAfter(item.id, item.depth)}
              title="Add entry after"
            >
              +
            </button>
            <button
              className={styles.actionBtn}
              onClick={() => onAddChild(item.id, item.depth)}
              title="Add child entry"
            >
              ⊕
            </button>
            {item.depth > 0 && (
              <button
                className={styles.actionBtn}
                onClick={() => onOutdent(item.id)}
                title="Outdent"
              >
                ←
              </button>
            )}
            <button
              className={styles.actionBtn}
              onClick={() => onIndent(item.id)}
              title="Indent"
            >
              →
            </button>
            <button
              className={`${styles.actionBtn} ${styles.deleteBtn}`}
              onClick={() => onDelete(item.id)}
              title="Delete"
            >
              ×
            </button>
          </div>
        )}
      </div>

      {/* Render children if not collapsed */}
      {hasChildren && !item.collapsed && (
        <TocTree
          items={item.children}
          activeId={activeId}
          editingId={editingId}
          onNavigate={onNavigate}
          onStartEdit={onStartEdit}
          onRename={onRename}
          onDelete={onDelete}
          onAddAfter={onAddAfter}
          onAddChild={onAddChild}
          onPageNumberChange={onPageNumberChange}
          onToggleCollapse={onToggleCollapse}
          onIndent={onIndent}
          onOutdent={onOutdent}
        />
      )}
    </>
  );
}

// ---- Tree manipulation helpers ----

/** Find the TocItem whose page is closest to (but <=) currentPage */
function findActiveTocId(items: TocItem[], currentPage: number): string | null {
  let bestId: string | null = null;
  let bestPage = -1;

  function walk(list: TocItem[]) {
    for (const item of list) {
      if (item.pageNumber <= currentPage && item.pageNumber > bestPage) {
        bestId = item.id;
        bestPage = item.pageNumber;
      }
      walk(item.children);
    }
  }

  walk(items);
  return bestId;
}

/** Update a single item in the tree by ID */
function updateItemInTree(
  items: TocItem[],
  id: string,
  updater: (item: TocItem) => TocItem,
): TocItem[] {
  return items.map((item) => {
    if (item.id === id) return updater(item);
    if (item.children.length > 0) {
      return { ...item, children: updateItemInTree(item.children, id, updater) };
    }
    return item;
  });
}

/** Remove an item from the tree by ID */
function removeItemFromTree(items: TocItem[], id: string): TocItem[] {
  return items
    .filter((item) => item.id !== id)
    .map((item) => ({
      ...item,
      children: removeItemFromTree(item.children, id),
    }));
}

/** Insert a new item after the item with the given ID (at the same level) */
function insertAfterInTree(
  items: TocItem[],
  afterId: string,
  newItem: TocItem,
): TocItem[] {
  const result: TocItem[] = [];
  for (const item of items) {
    result.push({
      ...item,
      children: insertAfterInTree(item.children, afterId, newItem),
    });
    if (item.id === afterId) {
      result.push(newItem);
    }
  }
  return result;
}

/** Add a new item as the last child of the item with the given ID */
function addChildInTree(
  items: TocItem[],
  parentId: string,
  newItem: TocItem,
): TocItem[] {
  return items.map((item) => {
    if (item.id === parentId) {
      return {
        ...item,
        children: [...item.children, newItem],
        collapsed: false, // Expand parent to show new child
      };
    }
    return {
      ...item,
      children: addChildInTree(item.children, parentId, newItem),
    };
  });
}

/** Indent: move item to become the last child of its previous sibling */
function indentItem(items: TocItem[], id: string): TocItem[] {
  for (let i = 0; i < items.length; i++) {
    if (items[i].id === id && i > 0) {
      const item = { ...items[i], depth: items[i].depth + 1 };
      const prevSibling = items[i - 1];
      const newPrev = {
        ...prevSibling,
        children: [...prevSibling.children, item],
        collapsed: false,
      };
      const result = [...items];
      result[i - 1] = newPrev;
      result.splice(i, 1);
      return result;
    }
    // Recurse into children
    const updated = indentItem(items[i].children, id);
    if (updated !== items[i].children) {
      const result = [...items];
      result[i] = { ...items[i], children: updated };
      return result;
    }
  }
  return items;
}

/** Outdent: move item to become the next sibling of its parent */
function outdentItem(items: TocItem[], id: string): TocItem[] {
  // We need to find the parent that contains this item as a child
  for (let i = 0; i < items.length; i++) {
    const childIdx = items[i].children.findIndex((c) => c.id === id);
    if (childIdx !== -1) {
      const child = {
        ...items[i].children[childIdx],
        depth: items[i].children[childIdx].depth - 1,
      };
      // Remove from parent's children
      const newChildren = [...items[i].children];
      newChildren.splice(childIdx, 1);
      const newParent = { ...items[i], children: newChildren };
      // Insert after parent
      const result = [...items];
      result[i] = newParent;
      result.splice(i + 1, 0, child);
      return result;
    }
    // Recurse
    const updated = outdentItem(items[i].children, id);
    if (updated !== items[i].children) {
      const result = [...items];
      result[i] = { ...items[i], children: updated };
      return result;
    }
  }
  return items;
}
