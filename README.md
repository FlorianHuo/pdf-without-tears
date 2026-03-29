# PDF Without Tears

A personal PDF ebook processing toolkit. A modern, lightweight desktop application for reading, processing, and managing PDF ebooks.

Built with [Tauri v2](https://tauri.app/) + [React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/).

## Features

### Current (v0.1.0)
- **PDF Viewer**: Open and render PDF files with high fidelity using pdf.js
- **Page Navigation**: Continuous scroll, page input, prev/next buttons
- **Zoom Controls**: Zoom in/out, fit width, keyboard shortcuts
- **Text Selection**: Select and copy text from PDFs
- **Sidebar**: Page thumbnail navigation
- **Drag & Drop**: Drop PDF files to open
- **Dark / Light Theme**: Toggle between dark and light mode

### Planned
- **OCR**: Add searchable text layers to scanned PDFs
- **TOC Editor**: Add or edit table of contents (bookmarks)
- **AI Sidebar**: Chat about PDF content with AI
- **PDF Editing**: Annotations, highlights, page operations

## Development

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+)
- [pnpm](https://pnpm.io/)
- [Rust](https://www.rust-lang.org/tools/install) (latest stable)

### Setup

```bash
# Install dependencies
pnpm install

# Run in development mode
pnpm tauri dev

# Build for production
pnpm tauri build
```

### Keyboard Shortcuts

| Shortcut | Action |
|:---|:---|
| Cmd + O | Open file |
| Cmd + +/- | Zoom in/out |
| Cmd + 0 | Reset zoom (fit width) |
| Arrow Up/Down | Navigate pages |

## Tech Stack

| Layer | Technology |
|:---|:---|
| App Framework | Tauri v2 (Rust) |
| Frontend | React 19 + TypeScript |
| PDF Rendering | pdf.js (via react-pdf) |
| Styling | Vanilla CSS (CSS Modules) |
| Build Tool | Vite |

## License

MIT
