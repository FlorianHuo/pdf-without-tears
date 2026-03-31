import Database from "@tauri-apps/plugin-sql";
import type {
  Book,
  BookFilter,
  BookSort,
  BookStatus,
} from "../types/book";

let db: Database | null = null;

/* ------------------------------------------------------------------ */
/*  Schema & migrations                                               */
/* ------------------------------------------------------------------ */

const BASE_SCHEMA = `
CREATE TABLE IF NOT EXISTS books (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  title            TEXT    NOT NULL,
  author           TEXT    NOT NULL DEFAULT '',
  file_path        TEXT    NOT NULL UNIQUE,
  is_copied        INTEGER NOT NULL DEFAULT 0,
  cover_thumb_path TEXT,
  tags             TEXT    NOT NULL DEFAULT '[]',
  category         TEXT    NOT NULL DEFAULT '',
  last_page        INTEGER NOT NULL DEFAULT 1,
  total_pages      INTEGER NOT NULL DEFAULT 0,
  added_at         TEXT    NOT NULL DEFAULT (datetime('now')),
  last_opened_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  status           TEXT    NOT NULL DEFAULT 'unread',
  is_archived      INTEGER NOT NULL DEFAULT 0,
  sort_order       INTEGER NOT NULL DEFAULT 0
);
`;

interface PragmaColumn {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | null;
  pk: number;
}

/**
 * Ensure the schema is up to date.
 * Handles both fresh installs and upgrades from older versions.
 */
async function migrate(d: Database): Promise<void> {
  await d.execute(BASE_SCHEMA);

  const cols = await d.select<PragmaColumn[]>("PRAGMA table_info(books)");
  const names = new Set(cols.map((c) => c.name));

  const additions: [string, string][] = [
    ["status", "TEXT NOT NULL DEFAULT 'unread'"],
    ["is_archived", "INTEGER NOT NULL DEFAULT 0"],
    ["sort_order", "INTEGER NOT NULL DEFAULT 0"],
  ];

  for (const [col, def] of additions) {
    if (!names.has(col)) {
      await d.execute(`ALTER TABLE books ADD COLUMN ${col} ${def}`);
    }
  }

  // Back-fill sort_order for existing rows that still have the 0 default
  await d.execute("UPDATE books SET sort_order = id WHERE sort_order = 0");
}

/* ------------------------------------------------------------------ */
/*  Connection                                                         */
/* ------------------------------------------------------------------ */

export async function getDb(): Promise<Database> {
  if (db) return db;
  db = await Database.load("sqlite:library.db");
  await migrate(db);
  return db;
}

/* ------------------------------------------------------------------ */
/*  Row <-> Book mapping                                               */
/* ------------------------------------------------------------------ */

interface RawBookRow {
  id: number;
  title: string;
  author: string;
  file_path: string;
  is_copied: number;
  cover_thumb_path: string | null;
  tags: string;
  category: string;
  last_page: number;
  total_pages: number;
  added_at: string;
  last_opened_at: string;
  status: string;
  is_archived: number;
  sort_order: number;
}

function rowToBook(row: RawBookRow): Book {
  return {
    ...row,
    is_copied: row.is_copied === 1,
    tags: JSON.parse(row.tags || "[]"),
    status: (row.status || "unread") as BookStatus,
    is_archived: row.is_archived === 1,
  };
}

/* ------------------------------------------------------------------ */
/*  Query helpers                                                      */
/* ------------------------------------------------------------------ */

/**
 * Flexible book retrieval with optional filtering and sorting.
 */
export async function getBooks(
  filter?: BookFilter,
  sort?: BookSort,
): Promise<Book[]> {
  const d = await getDb();
  const clauses: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (filter) {
    if (filter.isArchived !== undefined) {
      clauses.push(`is_archived = $${idx++}`);
      params.push(filter.isArchived ? 1 : 0);
    }

    if (filter.status) {
      clauses.push(`status = $${idx++}`);
      params.push(filter.status);
    }

    if (filter.category) {
      clauses.push(`category = $${idx++}`);
      params.push(filter.category);
    }

    if (filter.tags && filter.tags.length > 0) {
      for (const tag of filter.tags) {
        clauses.push(`tags LIKE $${idx++}`);
        params.push(`%${JSON.stringify(tag).slice(1, -1)}%`);
      }
    }

    if (filter.search && filter.search.trim()) {
      const term = `%${filter.search.trim()}%`;
      clauses.push(
        `(title LIKE $${idx} OR author LIKE $${idx} OR category LIKE $${idx} OR tags LIKE $${idx})`,
      );
      params.push(term);
      idx++;
    }
  }

  const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";

  let orderBy: string;
  if (sort) {
    const dir = sort.direction === "asc" ? "ASC" : "DESC";
    const collate = ["title", "author"].includes(sort.field) ? "COLLATE NOCASE" : "";
    orderBy = `ORDER BY ${sort.field} ${collate} ${dir}`;
  } else {
    orderBy = "ORDER BY last_opened_at DESC";
  }

  const rows = await d.select<RawBookRow[]>(
    `SELECT * FROM books ${where} ${orderBy}`,
    params,
  );
  return rows.map(rowToBook);
}

/** Backward-compatible shortcut. */
export async function getAllBooks(): Promise<Book[]> {
  return getBooks({ isArchived: false });
}

export async function getBookById(id: number): Promise<Book | null> {
  const d = await getDb();
  const rows = await d.select<RawBookRow[]>(
    "SELECT * FROM books WHERE id = $1",
    [id],
  );
  return rows.length > 0 ? rowToBook(rows[0]) : null;
}

export async function getBookByPath(path: string): Promise<Book | null> {
  const d = await getDb();
  const rows = await d.select<RawBookRow[]>(
    "SELECT * FROM books WHERE file_path = $1",
    [path],
  );
  return rows.length > 0 ? rowToBook(rows[0]) : null;
}

/* ------------------------------------------------------------------ */
/*  Write operations                                                   */
/* ------------------------------------------------------------------ */

export async function addBook(
  book: Omit<Book, "id" | "added_at" | "last_opened_at" | "status" | "is_archived" | "sort_order">,
): Promise<Book> {
  const d = await getDb();
  const maxRows = await d.select<{ m: number | null }[]>(
    "SELECT MAX(sort_order) as m FROM books",
  );
  const nextOrder = ((maxRows[0]?.m) ?? 0) + 1;

  const result = await d.execute(
    `INSERT INTO books
       (title, author, file_path, is_copied, cover_thumb_path,
        tags, category, last_page, total_pages, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      book.title,
      book.author,
      book.file_path,
      book.is_copied ? 1 : 0,
      book.cover_thumb_path,
      JSON.stringify(book.tags),
      book.category,
      book.last_page,
      book.total_pages,
      nextOrder,
    ],
  );
  const inserted = await getBookById(result.lastInsertId as number);
  return inserted!;
}

export async function updateBook(
  id: number,
  fields: Partial<
    Pick<
      Book,
      | "title"
      | "author"
      | "tags"
      | "category"
      | "last_page"
      | "total_pages"
      | "cover_thumb_path"
      | "last_opened_at"
      | "status"
      | "is_archived"
      | "sort_order"
    >
  >,
): Promise<void> {
  const d = await getDb();
  const sets: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  for (const [key, value] of Object.entries(fields)) {
    if (key === "tags") {
      sets.push(`tags = $${idx++}`);
      values.push(JSON.stringify(value));
    } else if (key === "is_copied" || key === "is_archived") {
      sets.push(`${key} = $${idx++}`);
      values.push(value ? 1 : 0);
    } else {
      sets.push(`${key} = $${idx++}`);
      values.push(value);
    }
  }

  if (sets.length === 0) return;
  values.push(id);
  await d.execute(
    `UPDATE books SET ${sets.join(", ")} WHERE id = $${idx}`,
    values,
  );
}

/**
 * Delete a book. Returns paths so the caller can remove physical files.
 */
export async function deleteBook(
  id: number,
): Promise<{ filePath: string; thumbPath: string | null } | null> {
  const book = await getBookById(id);
  if (!book) return null;
  const d = await getDb();
  await d.execute("DELETE FROM books WHERE id = $1", [id]);
  return { filePath: book.file_path, thumbPath: book.cover_thumb_path };
}

export async function archiveBook(id: number): Promise<void> {
  await updateBook(id, { is_archived: true });
}

export async function unarchiveBook(id: number): Promise<void> {
  await updateBook(id, { is_archived: false });
}

export async function updateBookStatus(
  id: number,
  status: BookStatus,
): Promise<void> {
  await updateBook(id, { status });
}

/**
 * Persist a new manual ordering.
 */
export async function reorderBooks(orderedIds: number[]): Promise<void> {
  const d = await getDb();
  for (let i = 0; i < orderedIds.length; i++) {
    await d.execute("UPDATE books SET sort_order = $1 WHERE id = $2", [
      i + 1,
      orderedIds[i],
    ]);
  }
}

/* ------------------------------------------------------------------ */
/*  Aggregation helpers                                                */
/* ------------------------------------------------------------------ */

export async function getAllTags(): Promise<string[]> {
  const d = await getDb();
  const rows = await d.select<{ tags: string }[]>(
    "SELECT DISTINCT tags FROM books WHERE tags != '[]'",
  );
  const tagSet = new Set<string>();
  for (const row of rows) {
    try {
      const parsed: string[] = JSON.parse(row.tags);
      parsed.forEach((t) => tagSet.add(t));
    } catch { /* ignore */ }
  }
  return [...tagSet].sort();
}

export async function getAllCategories(): Promise<string[]> {
  const d = await getDb();
  const rows = await d.select<{ category: string }[]>(
    "SELECT DISTINCT category FROM books WHERE category != '' ORDER BY category COLLATE NOCASE",
  );
  return rows.map((r) => r.category);
}

export async function getLibraryStats(): Promise<{
  total: number;
  unread: number;
  reading: number;
  finished: number;
  archived: number;
}> {
  const d = await getDb();
  const rows = await d.select<
    { status: string; is_archived: number; cnt: number }[]
  >(
    "SELECT status, is_archived, COUNT(*) as cnt FROM books GROUP BY status, is_archived",
  );
  const stats = { total: 0, unread: 0, reading: 0, finished: 0, archived: 0 };
  for (const r of rows) {
    stats.total += r.cnt;
    if (r.is_archived) {
      stats.archived += r.cnt;
    } else {
      if (r.status === "unread") stats.unread += r.cnt;
      else if (r.status === "reading") stats.reading += r.cnt;
      else if (r.status === "finished") stats.finished += r.cnt;
    }
  }
  return stats;
}