import { useState, useCallback, useEffect, useRef } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { readFile, writeFile } from "@tauri-apps/plugin-fs";
import { getCurrentWindow } from "@tauri-apps/api/window";
import Toolbar from "./components/Toolbar/Toolbar";
import LibraryToolbar from "./components/LibraryToolbar/LibraryToolbar";
import Sidebar from "./components/Sidebar/Sidebar";
import PdfViewer from "./components/PdfViewer/PdfViewer";
import type { ZoomMode } from "./components/PdfViewer/PdfViewer";
import StatusBar from "./components/StatusBar/StatusBar";
import LibraryView from "./components/LibraryView/LibraryView";
import SettingsDialog from "./components/SettingsDialog/SettingsDialog";
import { writeTocToPdf } from "./utils/tocWriter";
import {
  aiGenerateToc,
  loadAiConfig,
  getFullConfig,
} from "./utils/aiTocGenerator";
import type { AiTocProgress } from "./utils/aiTocGenerator";
import { getAllBooks, getBookById, updateBook, addBook, getBookByPath } from "./utils/db";
import {
  generateThumbnail,
  getPdfPageCount,
} from "./utils/thumbnailGenerator";
import type { Book } from "./types/book";
import type { TocItem } from "./types/toc";
import styles from "./App.module.css";

type AppView =
  | { kind: "library" }
  | { kind: "reader"; bookId: number | null };

function App() {
  // --- Theme State ---
  const [isDark, setIsDark] = useState(() => {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  useEffect(() => {
    document.documentElement.setAttribute(
      "data-theme",
      isDark ? "dark" : "light",
    );
  }, [isDark]);

  // --- View State ---
  const [view, setView] = useState<AppView>({ kind: "library" });

  // --- Library State ---
  const [books, setBooks] = useState<Book[]>([]);

  const refreshBooks = useCallback(async () => {
    try {
      const allBooks = await getAllBooks();
      setBooks(allBooks);
    } catch (err) {
      console.error("Failed to load books:", err);
    }
  }, []);

  useEffect(() => {
    refreshBooks();
  }, [refreshBooks]);

  const thumbnailBackfillAttemptedRef = useRef(new Set<number>());

  useEffect(() => {
    const missingThumbs = books.filter(
      (book) =>
        !book.cover_thumb_path &&
        !thumbnailBackfillAttemptedRef.current.has(book.id),
    );

    if (missingThumbs.length === 0) {
      return;
    }

    let cancelled = false;

    void (async () => {
      let updatedAny = false;

      for (const book of missingThumbs) {
        thumbnailBackfillAttemptedRef.current.add(book.id);

        try {
          const fileData = await readFile(book.file_path);
          const pdfBytes = new Uint8Array(fileData);
          const thumbPath = await generateThumbnail(pdfBytes, book.id);
          await updateBook(book.id, { cover_thumb_path: thumbPath });
          updatedAny = true;
        } catch (err) {
          console.error(`Failed to backfill thumbnail for ${book.title}:`, err);
        }
      }

      if (updatedAny && !cancelled) {
        await refreshBooks();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [books, refreshBooks]);

  // --- Toast Notification ---
  const [toasts, setToasts] = useState<
    { id: number; message: string; type: "success" | "error" | "warning" }[]
  >([]);
  const toastIdRef = useRef(0);

  const showToast = useCallback(
    (message: string, type: "success" | "error" | "warning" = "success") => {
      const id = ++toastIdRef.current;
      setToasts((prev) => [...prev, { id, message, type }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4000);
    },
    [],
  );

  // --- Import to Library ---
  const [importing, setImporting] = useState(false);

  const handleImportToLibrary = useCallback(async () => {
    try {
      const selected = await open({
        multiple: true,
        filters: [{ name: "PDF Documents", extensions: ["pdf"] }],
      });

      if (!selected) return;
      const paths = Array.isArray(selected) ? selected : [selected];

      setImporting(true);
      for (const filePath of paths) {
        const existing = await getBookByPath(filePath);
        if (existing) continue;

        const fileData = await readFile(filePath);
        const pdfBytes = new Uint8Array(fileData);
        const totalPg = await getPdfPageCount(pdfBytes);

        const fName = filePath.split("/").pop() || "document.pdf";
        const title = fName.replace(/\.pdf$/i, "");

        const book = await addBook({
          title,
          author: "",
          file_path: filePath,
          is_copied: false,
          cover_thumb_path: null,
          tags: [],
          category: "",
          last_page: 1,
          total_pages: totalPg,
        });

        // Generate thumbnail in background
        generateThumbnail(pdfBytes, book.id)
          .then(async (thumbPath) => {
            await updateBook(book.id, { cover_thumb_path: thumbPath });
            refreshBooks();
          })
          .catch((err) => console.error("Thumbnail generation failed:", err));
      }

      refreshBooks();
    } catch (err) {
      console.error("Import failed:", err);
      showToast("Failed to import PDF.", "error");
    } finally {
      setImporting(false);
    }
  }, [refreshBooks, showToast]);

  // --- PDF State ---
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [zoom, setZoom] = useState(1.0);
  const [zoomMode, setZoomMode] = useState<ZoomMode>("fit-width");

  // --- TOC State ---
  const [tocItems, setTocItems] = useState<TocItem[]>([]);
  const [tocModified, setTocModified] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Keep the file path for saving back
  const filePathRef = useRef<string | null>(null);
  // Keep a ref for the blob URL to avoid stale closure issues
  const fileUrlRef = useRef<string | null>(null);

  // --- PDF Proxy (for AI TOC generation) ---
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfProxyRef = useRef<any>(null);

  // --- AI TOC State ---
  const [aiProgress, setAiProgress] = useState<AiTocProgress | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // --- UI State ---
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [isDragging, setIsDragging] = useState(false);
  const isResizingRef = useRef(false);

  // --- Load PDF into reader ---
  const loadPdfFile = useCallback(async (filePath: string) => {
    try {
      const fileData = await readFile(filePath);
      const blob = new Blob([fileData], { type: "application/pdf" });
      const blobUrl = URL.createObjectURL(blob);

      // Clean up previous blob URL
      if (fileUrlRef.current) {
        URL.revokeObjectURL(fileUrlRef.current);
      }

      filePathRef.current = filePath;
      fileUrlRef.current = blobUrl;
      setFileUrl(blobUrl);
      setFileName(filePath.split("/").pop() || "document.pdf");
      setCurrentPage(1);
      setTotalPages(0);
      setZoom(1.0);
      setZoomMode("fit-width");
      setTocItems([]);
      setTocModified(false);
    } catch (err) {
      console.error("Failed to read PDF file:", err);
      showToast("Failed to open PDF file.", "error");
    }
  }, [showToast]);

  // --- Open Book from Library ---
  const handleOpenBook = useCallback(async (bookId: number) => {
    try {
      const book = await getBookById(bookId);
      if (!book) return;

      const fileData = await readFile(book.file_path);
      const blob = new Blob([fileData], { type: "application/pdf" });
      const blobUrl = URL.createObjectURL(blob);

      if (fileUrlRef.current) {
        URL.revokeObjectURL(fileUrlRef.current);
      }

      filePathRef.current = book.file_path;
      fileUrlRef.current = blobUrl;
      setFileUrl(blobUrl);
      setFileName(book.title);
      setCurrentPage(book.last_page);
      setTotalPages(book.total_pages);
      setZoom(1.0);
      setZoomMode("fit-width");
      setTocItems([]);
      setTocModified(false);
      setView({ kind: "reader", bookId });

      // Update last opened time
      await updateBook(bookId, {
        last_opened_at: new Date().toISOString(),
      });
    } catch (err) {
      console.error("Failed to open book:", err);
      showToast("Failed to open book.", "error");
    }
  }, [showToast]);

  // --- Back to Library ---
  const handleBackToLibrary = useCallback(async () => {
    // Save reading progress if opening from library
    if (view.kind === "reader" && view.bookId !== null) {
      try {
        await updateBook(view.bookId, {
          last_page: currentPage,
          total_pages: totalPages,
        });
      } catch (err) {
        console.error("Failed to save reading progress:", err);
      }
    }

    // Clean up PDF state
    if (fileUrlRef.current) {
      URL.revokeObjectURL(fileUrlRef.current);
    }
    filePathRef.current = null;
    fileUrlRef.current = null;
    setFileUrl(null);
    setFileName(null);
    setCurrentPage(1);
    setTotalPages(0);
    setTocItems([]);
    setTocModified(false);
    pdfProxyRef.current = null;

    setView({ kind: "library" });
    refreshBooks();
  }, [view, currentPage, totalPages, refreshBooks]);

  // --- Reading Progress Auto-Save ---
  const progressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (view.kind !== "reader" || view.bookId === null) return;

    if (progressTimerRef.current) {
      clearTimeout(progressTimerRef.current);
    }

    const bookId = view.bookId;
    progressTimerRef.current = setTimeout(() => {
      updateBook(bookId, { last_page: currentPage }).catch((err) =>
        console.error("Failed to save progress:", err),
      );
    }, 2000);

    return () => {
      if (progressTimerRef.current) {
        clearTimeout(progressTimerRef.current);
      }
    };
  }, [currentPage, view]);

  // --- Open File (direct, outside library) ---
  const handleOpenFile = useCallback(async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [
          {
            name: "PDF Documents",
            extensions: ["pdf"],
          },
        ],
      });

      if (selected) {
        await loadPdfFile(selected as string);
        setView({ kind: "reader", bookId: null });
      }
    } catch (err) {
      console.error("Failed to open file dialog:", err);
    }
  }, [loadPdfFile]);

  // --- Document Load Handler ---
  const handleDocumentLoad = useCallback((numPages: number) => {
    setTotalPages(numPages);
  }, []);

  // --- Outline Load Handler ---
  const handleOutlineLoad = useCallback((items: TocItem[]) => {
    setTocItems(items);
    setTocModified(false);
  }, []);

  // --- PDF Proxy Handler ---
  const handlePdfLoad = useCallback((pdf: unknown) => {
    pdfProxyRef.current = pdf;
  }, []);

  // --- AI TOC Generation ---
  const aiAbortRef = useRef<AbortController | null>(null);

  const handleAiGenerate = useCallback(async () => {
    const pdf = pdfProxyRef.current;
    if (!pdf) return;

    const savedConfig = loadAiConfig();
    const config = getFullConfig(savedConfig);

    if (!config) {
      showToast("Please configure your API key first.", "warning");
      setSettingsOpen(true);
      return;
    }

    const abortController = new AbortController();
    aiAbortRef.current = abortController;

    try {
      const result = await aiGenerateToc(pdf, config, (progress) => {
        setAiProgress({ ...progress });
      }, abortController.signal);

      if (result.length > 0) {
        setTocItems(result);
        setTocModified(true);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setAiProgress({
          status: "done",
          message: "Generation cancelled.",
        });
      } else {
        console.error("AI TOC generation failed:", err);
        showToast(
          `AI generation failed: ${err instanceof Error ? err.message : String(err)}`,
          "error",
        );
        setAiProgress({
          status: "error",
          message: `Error: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    } finally {
      aiAbortRef.current = null;
      setTimeout(() => setAiProgress(null), 3000);
    }
  }, [showToast]);

  const handleAiCancel = useCallback(() => {
    aiAbortRef.current?.abort();
  }, []);

  // --- TOC Update Handler ---
  const handleTocUpdate = useCallback((items: TocItem[]) => {
    setTocItems(items);
    setTocModified(true);
  }, []);

  // --- Save TOC to PDF ---
  const handleSaveToc = useCallback(async () => {
    const filePath = filePathRef.current;
    if (!filePath || tocItems.length === 0 || isSaving) return;

    setIsSaving(true);
    try {
      const originalBytes = await readFile(filePath);
      const modifiedBytes = await writeTocToPdf(
        new Uint8Array(originalBytes),
        tocItems,
      );
      await writeFile(filePath, modifiedBytes);

      setTocModified(false);
      showToast("TOC saved successfully.", "success");
    } catch (err) {
      console.error("Failed to save TOC:", err);
      showToast("Failed to save TOC to PDF.", "error");
    } finally {
      setIsSaving(false);
    }
  }, [tocItems, isSaving, showToast]);

  // --- Tauri Native Drag & Drop ---
  // Use a ref for view so the Tauri event handler always has the latest state
  const viewRef = useRef(view);
  useEffect(() => { viewRef.current = view; }, [view]);

  // Prevent browser default drag/drop behavior (opening the file)
  useEffect(() => {
    const prevent = (e: Event) => { e.preventDefault(); };
    window.addEventListener("dragover", prevent);
    window.addEventListener("drop", prevent);
    return () => {
      window.removeEventListener("dragover", prevent);
      window.removeEventListener("drop", prevent);
    };
  }, []);

  // Tauri native file drag-and-drop handler
  useEffect(() => {
    let cancelled = false;
    let unlistenFn: (() => void) | null = null;

    const appWindow = getCurrentWindow();
    appWindow.onDragDropEvent(async (event) => {
      if (cancelled) return;

      if (event.payload.type === "enter") {
        setIsDragging(true);
      } else if (event.payload.type === "leave") {
        setIsDragging(false);
      } else if (event.payload.type === "drop") {
        setIsDragging(false);

        const pdfPaths = event.payload.paths.filter((p: string) =>
          p.toLowerCase().endsWith(".pdf"),
        );
        if (pdfPaths.length === 0) return;

        if (viewRef.current.kind === "library") {
          // Import dropped PDFs into library
          setImporting(true);
          try {
            for (const filePath of pdfPaths) {
              const existing = await getBookByPath(filePath);
              if (existing) continue;

              const fileData = await readFile(filePath);
              const pdfBytes = new Uint8Array(fileData);
              const totalPg = await getPdfPageCount(pdfBytes);

              const fName = filePath.split("/").pop() || "document.pdf";
              const title = fName.replace(/\.pdf$/i, "");

              const book = await addBook({
                title,
                author: "",
                file_path: filePath,
                is_copied: false,
                cover_thumb_path: null,
                tags: [],
                category: "",
                last_page: 1,
                total_pages: totalPg,
              });

              generateThumbnail(pdfBytes, book.id)
                .then(async (thumbPath) => {
                  await updateBook(book.id, { cover_thumb_path: thumbPath });
                  refreshBooks();
                })
                .catch((err) => console.error("Thumbnail generation failed:", err));
            }
            refreshBooks();
          } catch (err) {
            console.error("Drop import failed:", err);
          } finally {
            setImporting(false);
          }
        } else {
          // In reader view, open the first dropped PDF
          await loadPdfFile(pdfPaths[0]);
        }
      }
    }).then((fn) => {
      if (cancelled) {
        fn();
      } else {
        unlistenFn = fn;
      }
    });

    return () => {
      cancelled = true;
      unlistenFn?.();
    };
  }, [refreshBooks, loadPdfFile]);

  // --- Keyboard Shortcuts ---
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;

      // Cmd+O: Import (library) or open file (reader)
      if (isMod && e.key === "o") {
        e.preventDefault();
        if (view.kind === "library") {
          handleImportToLibrary();
        } else {
          handleOpenFile();
        }
      }

      // Cmd+S: Save TOC (reader only)
      if (isMod && e.key === "s" && view.kind === "reader") {
        e.preventDefault();
        if (tocModified) {
          handleSaveToc();
        }
      }

      // Escape: back to library
      if (e.key === "Escape" && view.kind === "reader") {
        e.preventDefault();
        handleBackToLibrary();
      }

      // Navigate pages (reader only)
      if (!isMod && fileUrl && view.kind === "reader") {
        if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
          if ((e.target as HTMLElement).tagName === "INPUT") return;
          e.preventDefault();
          setCurrentPage((p) => Math.max(1, p - 1));
        } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
          if ((e.target as HTMLElement).tagName === "INPUT") return;
          e.preventDefault();
          setCurrentPage((p) => Math.min(totalPages, p + 1));
        }
      }

      // Cmd+Plus/Minus: Zoom (reader only)
      if (view.kind === "reader") {
        if (isMod && (e.key === "=" || e.key === "+")) {
          e.preventDefault();
          setZoom((z) => Math.min(5.0, z + 0.25));
        }
        if (isMod && e.key === "-") {
          e.preventDefault();
          setZoom((z) => Math.max(0.25, z - 0.25));
        }
        if (isMod && e.key === "0") {
          e.preventDefault();
          setZoomMode("fit-width");
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleOpenFile, handleImportToLibrary, handleSaveToc, handleBackToLibrary, fileUrl, totalPages, tocModified, view]);

  const hasDocument = fileUrl !== null;

  return (
    <div
      className={styles.app}
    >
      {/* Toolbar switches based on view */}
      {view.kind === "library" ? (
        <LibraryToolbar
          onImport={handleImportToLibrary}
          onOpenSettings={() => setSettingsOpen(true)}
          onToggleTheme={() => setIsDark(!isDark)}
          isDark={isDark}
          bookCount={books.length}
        />
      ) : (
        <Toolbar
          currentPage={currentPage}
          totalPages={totalPages}
          zoom={zoom}
          zoomMode={zoomMode}
          hasDocument={hasDocument}
          sidebarVisible={sidebarVisible}
          onOpenFile={handleOpenFile}
          onPageChange={setCurrentPage}
          onZoomChange={setZoom}
          onZoomModeChange={setZoomMode}
          onToggleSidebar={() => setSidebarVisible(!sidebarVisible)}
          onToggleTheme={() => setIsDark(!isDark)}
          isDark={isDark}
          tocModified={tocModified}
          isSaving={isSaving}
          onSaveToc={handleSaveToc}
          onOpenSettings={() => setSettingsOpen(true)}
          onBackToLibrary={handleBackToLibrary}
        />
      )}

      <div className={styles.workspace}>
        {view.kind === "reader" && hasDocument && (
          <>
            <Sidebar
              visible={sidebarVisible}
              fileUrl={fileUrl}
              totalPages={totalPages}
              currentPage={currentPage}
              tocItems={tocItems}
              onPageChange={setCurrentPage}
              onTocUpdate={handleTocUpdate}
              onAiGenerate={handleAiGenerate}
              onAiCancel={handleAiCancel}
              aiProgress={aiProgress}
              width={sidebarWidth}
            />
            {sidebarVisible && (
              <div
                className={styles.resizeHandle}
                onMouseDown={(e) => {
                  e.preventDefault();
                  isResizingRef.current = true;
                  const startX = e.clientX;
                  const startWidth = sidebarWidth;
                  const onMouseMove = (ev: MouseEvent) => {
                    if (!isResizingRef.current) return;
                    const newWidth = Math.max(200, Math.min(600, startWidth + ev.clientX - startX));
                    setSidebarWidth(newWidth);
                  };
                  const onMouseUp = () => {
                    isResizingRef.current = false;
                    document.removeEventListener('mousemove', onMouseMove);
                    document.removeEventListener('mouseup', onMouseUp);
                    document.body.style.cursor = '';
                    document.body.style.userSelect = '';
                  };
                  document.addEventListener('mousemove', onMouseMove);
                  document.addEventListener('mouseup', onMouseUp);
                  document.body.style.cursor = 'col-resize';
                  document.body.style.userSelect = 'none';
                }}
              />
            )}
          </>
        )}

        <main className={styles.main}>
          {view.kind === "library" ? (
            <LibraryView
              onOpenBook={handleOpenBook}
              onImport={handleImportToLibrary}
              isDragging={isDragging}
              books={books}
              importing={importing}
            />
          ) : hasDocument ? (
            <PdfViewer
              fileUrl={fileUrl}
              currentPage={currentPage}
              zoom={zoom}
              zoomMode={zoomMode}
              onDocumentLoad={handleDocumentLoad}
              onPageChange={setCurrentPage}
              onOutlineLoad={handleOutlineLoad}
              onPdfLoad={handlePdfLoad}
            />
          ) : null}
        </main>
      </div>

      {view.kind === "reader" && (
        <StatusBar
          currentPage={currentPage}
          totalPages={totalPages}
          zoom={zoom}
          fileName={fileName}
        />
      )}
      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
      {toasts.length > 0 && (
        <div className={styles.toastContainer}>
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`${styles.toast} ${
                t.type === "success"
                  ? styles.toastSuccess
                  : t.type === "error"
                    ? styles.toastError
                    : styles.toastWarning
              }`}
            >
              {t.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default App;
