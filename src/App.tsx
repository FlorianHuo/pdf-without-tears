import { useState, useCallback, useEffect, useRef } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { readFile, writeFile } from "@tauri-apps/plugin-fs";
import Toolbar from "./components/Toolbar/Toolbar";
import Sidebar from "./components/Sidebar/Sidebar";
import PdfViewer from "./components/PdfViewer/PdfViewer";
import StatusBar from "./components/StatusBar/StatusBar";
import WelcomeScreen from "./components/WelcomeScreen/WelcomeScreen";
import { writeTocToPdf } from "./utils/tocWriter";
import type { TocItem } from "./types/toc";
import styles from "./App.module.css";

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

  // --- PDF State ---
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [zoom, setZoom] = useState(1.0);

  // --- TOC State ---
  const [tocItems, setTocItems] = useState<TocItem[]>([]);
  const [tocModified, setTocModified] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Keep the file path for saving back
  const filePathRef = useRef<string | null>(null);

  // --- UI State ---
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [isDragging, setIsDragging] = useState(false);

  // --- Open File Handler ---
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
      }
    } catch (err) {
      console.error("Failed to open file dialog:", err);
    }
  }, []);

  const loadPdfFile = async (filePath: string) => {
    try {
      const fileData = await readFile(filePath);
      const blob = new Blob([fileData], { type: "application/pdf" });
      const blobUrl = URL.createObjectURL(blob);

      // Clean up previous blob URL
      if (fileUrl) {
        URL.revokeObjectURL(fileUrl);
      }

      filePathRef.current = filePath;
      setFileUrl(blobUrl);
      setFileName(filePath.split("/").pop() || "document.pdf");
      setCurrentPage(1);
      setTotalPages(0);
      setZoom(1.0);
      setTocItems([]);
      setTocModified(false);
    } catch (err) {
      console.error("Failed to read PDF file:", err);
    }
  };

  // --- Document Load Handler ---
  const handleDocumentLoad = useCallback((numPages: number) => {
    setTotalPages(numPages);
  }, []);

  // --- Outline Load Handler ---
  const handleOutlineLoad = useCallback((items: TocItem[]) => {
    setTocItems(items);
    setTocModified(false);
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
      // Read the original PDF bytes
      const originalBytes = await readFile(filePath);

      // Inject the new outline
      const modifiedBytes = await writeTocToPdf(
        new Uint8Array(originalBytes),
        tocItems,
      );

      // Overwrite the original file
      await writeFile(filePath, modifiedBytes);

      setTocModified(false);
      console.log("TOC saved successfully to", filePath);
    } catch (err) {
      console.error("Failed to save TOC:", err);
      // TODO: Show user-facing error notification
    } finally {
      setIsSaving(false);
    }
  }, [tocItems, isSaving]);

  // --- Drag & Drop Handlers ---
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
        const filePath = (file as any).path;
        if (filePath) {
          await loadPdfFile(filePath);
        } else {
          const blobUrl = URL.createObjectURL(file);
          if (fileUrl) URL.revokeObjectURL(fileUrl);
          filePathRef.current = null;
          setFileUrl(blobUrl);
          setFileName(file.name);
          setCurrentPage(1);
          setTotalPages(0);
          setZoom(1.0);
          setTocItems([]);
          setTocModified(false);
        }
      }
    }
  }, [fileUrl]);

  // --- Keyboard Shortcuts ---
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;

      // Cmd+O: Open file
      if (isMod && e.key === "o") {
        e.preventDefault();
        handleOpenFile();
      }

      // Cmd+S: Save TOC
      if (isMod && e.key === "s") {
        e.preventDefault();
        if (tocModified) {
          handleSaveToc();
        }
      }

      // Navigate pages
      if (!isMod && fileUrl) {
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

      // Cmd+Plus/Minus: Zoom
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
        setZoom(1.0);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleOpenFile, handleSaveToc, fileUrl, totalPages, tocModified]);

  const hasDocument = fileUrl !== null;

  return (
    <div
      className={styles.app}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <Toolbar
        currentPage={currentPage}
        totalPages={totalPages}
        zoom={zoom}
        hasDocument={hasDocument}
        sidebarVisible={sidebarVisible}
        onOpenFile={handleOpenFile}
        onPageChange={setCurrentPage}
        onZoomChange={setZoom}
        onToggleSidebar={() => setSidebarVisible(!sidebarVisible)}
        onToggleTheme={() => setIsDark(!isDark)}
        isDark={isDark}
        tocModified={tocModified}
        isSaving={isSaving}
        onSaveToc={handleSaveToc}
      />

      <div className={styles.workspace}>
        {hasDocument && (
          <Sidebar
            visible={sidebarVisible}
            fileUrl={fileUrl}
            totalPages={totalPages}
            currentPage={currentPage}
            tocItems={tocItems}
            onPageChange={setCurrentPage}
            onTocUpdate={handleTocUpdate}
          />
        )}

        <main className={styles.main}>
          {hasDocument ? (
            <PdfViewer
              fileUrl={fileUrl}
              currentPage={currentPage}
              zoom={zoom}
              onDocumentLoad={handleDocumentLoad}
              onPageChange={setCurrentPage}
              onOutlineLoad={handleOutlineLoad}
            />
          ) : (
            <WelcomeScreen
              onOpenFile={handleOpenFile}
              isDragging={isDragging}
            />
          )}
        </main>
      </div>

      <StatusBar
        currentPage={currentPage}
        totalPages={totalPages}
        zoom={zoom}
        fileName={fileName}
      />
    </div>
  );
}

export default App;
