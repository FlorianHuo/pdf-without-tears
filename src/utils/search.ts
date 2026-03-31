/**
 * Lightweight fuzzy search for the book library.
 *
 * Supports CJK (Chinese/Japanese/Korean) characters where trigram-based
 * approaches don't work well — instead uses character-subsequence matching.
 */
import type { Book } from "../types/book";

/* ------------------------------------------------------------------ */
/*  Scoring                                                            */
/* ------------------------------------------------------------------ */

/**
 * Compute a relevance score (0–1) for how well `query` matches `text`.
 * Returns 0 when there is no match at all.
 */
export function fuzzyScore(query: string, text: string): number {
  if (!query || !text) return 0;

  const q = query.toLowerCase();
  const t = text.toLowerCase();

  // Exact substring → highest score
  if (t.includes(q)) return 1;

  // Word-prefix matching (each query token is a prefix of a word)
  const queryTokens = q.split(/\s+/).filter(Boolean);
  const textTokens = t.split(/\s+/).filter(Boolean);
  if (queryTokens.length > 0) {
    let prefixMatches = 0;
    for (const qt of queryTokens) {
      if (textTokens.some((tt) => tt.startsWith(qt))) {
        prefixMatches++;
      }
    }
    if (prefixMatches === queryTokens.length) {
      return 0.8;
    }
  }

  // Character-subsequence matching (good for CJK)
  let qi = 0;
  let matched = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      matched++;
      qi++;
    }
  }
  if (qi === q.length) {
    // All query chars found in order
    return 0.3 + 0.4 * (matched / t.length);
  }

  return 0;
}

/* ------------------------------------------------------------------ */
/*  Full-library search                                                */
/* ------------------------------------------------------------------ */

/**
 * Score every book against the query and return only those that match,
 * sorted by relevance (best first).
 */
export function fuzzySearchBooks(books: Book[], query: string): Book[] {
  if (!query.trim()) return books;

  const scored: { book: Book; score: number }[] = [];

  for (const book of books) {
    const titleScore = fuzzyScore(query, book.title) * 1.5;
    const authorScore = fuzzyScore(query, book.author) * 1.2;
    const categoryScore = fuzzyScore(query, book.category);
    const tagScore = Math.max(
      ...book.tags.map((t) => fuzzyScore(query, t)),
      0,
    );
    const best = Math.max(titleScore, authorScore, categoryScore, tagScore);
    if (best > 0) {
      scored.push({ book, score: best });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.book);
}
