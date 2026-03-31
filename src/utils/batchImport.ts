/**
 * Recursively scan a directory for PDF files.
 *
 * Uses Tauri's fs plugin (readDir) so it works within the
 * sandboxed application environment.
 */
import { readDir } from "@tauri-apps/plugin-fs";

export interface ScanResult {
  pdfPaths: string[];
  errors: string[];
}

/**
 * Recursively walk `dirPath` and collect all *.pdf file paths.
 *
 * @param dirPath  Absolute directory path to scan.
 * @param maxDepth Maximum recursion depth (default 5 to prevent runaway traversal).
 */
export async function scanDirectoryForPdfs(
  dirPath: string,
  maxDepth = 5,
): Promise<ScanResult> {
  const pdfPaths: string[] = [];
  const errors: string[] = [];

  async function walk(dir: string, depth: number) {
    if (depth > maxDepth) return;

    try {
      const entries = await readDir(dir);
      for (const entry of entries) {
        const fullPath = `${dir}/${entry.name}`;
        if (entry.isDirectory) {
          await walk(fullPath, depth + 1);
        } else if (entry.name.toLowerCase().endsWith(".pdf")) {
          pdfPaths.push(fullPath);
        }
      }
    } catch (err) {
      errors.push(`Failed to read ${dir}: ${err}`);
    }
  }

  await walk(dirPath, 0);
  return { pdfPaths, errors };
}
