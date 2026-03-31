import { cp, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const pdfjsPackagePath = require.resolve("pdfjs-dist/package.json");
const pdfjsDir = path.dirname(pdfjsPackagePath);
const targets = [
  [path.join(pdfjsDir, "cmaps"), path.join(projectRoot, "public", "pdfjs", "cmaps")],
  [
    path.join(pdfjsDir, "standard_fonts"),
    path.join(projectRoot, "public", "pdfjs", "standard_fonts"),
  ],
];

for (const [, destination] of targets) {
  await mkdir(path.dirname(destination), { recursive: true });
}

for (const [source, destination] of targets) {
  await cp(source, destination, { recursive: true, force: true });
}

console.log("Synchronized pdf.js assets into public/pdfjs.");