import Database from "@tauri-apps/plugin-sql";
import type { Book } from "../types/book";

let db: Database | null = null;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS books (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  title         TEXT NOT NULL,
  author        TEXT NOT NULL DEFAULT '',
  file_path     TEXT NOT NULL UNIQUE,
  is_copied     INTEGER NOT NULL DEFAULT 0,
  cover_thumb_path TEXT,
  tags          TEXT NOT NULL DEFAULT '[]',
  category      TEXT NOT NULL DEFAULT '',
  last_page     INTEGER NOT NULL DEFAULT 1,
  total_pages   INTEGER NOT NULL DEFAULT 0,
  added_at      TEXT NOT NULL DEFAULT (datetime('now')),
  last_opened_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

export async function getDb(): Promise<Database> {
  if (db) return db;
  db = await Database.load("sqlite:library.db");
  await db.execute(SCHEMA);
  return db;
}

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
}

function rowToBook(row: RawBookRow): Book {
  return {
    ...row,
    is_copied: row.is_copied === 1,
    tags: JSON.parse(row.tags || "[]"),
  };
}

export async function getAllBooks(): Promise<Book[]> {
  const d = await getDb();
  const rows = await d.select<RawBookRow[]>(
    "SELECT * FROM books ORDER BY last_opened_at DESC",
  );
  return rows.map(rowToBook);
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

export async function addBook(
  book: Omit<Book, "id" | "added_at" | "last_opened_at">,
): Promise<Book> {
  const d = await getDb();
  const result = await d.execute(
    `INSERT INTO books (title, author, file_path, is_copied, cover_thumb_path, tags, category, last_page, total_pages)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
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
    ],
  );
  const inserted = await getBookById(result.lastInsertId as number);
  return inserted!;
}

export async function updateBook(
  id: number,
  fields: Partial<Pick<Book, "title" | "author" | "tags" | "category" | "last_page" | "total_pages" | "cover_thumb_path" | "last_opened_at">>,
): Promise<void> {
  const d = await getDb();
  const sets: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  for (const [key, value] of Object.entries(fields)) {
    if (key === "tags") {
      sets.push(`tags = $${idx++}`);
      values.push(JSON.stringify(value));
    } else if (key === "is_copied") {
      sets.push(`is_copied = $${idx++}`);
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

export async function deleteBook(id: number): Promise<void> {
  const d = await getDb();
  await d.execute("DELETE FROM books WHERE id = $1", [id]);
}
