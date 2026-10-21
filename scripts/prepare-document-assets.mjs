import fs from "node:fs/promises";
import path from "node:path";
const root = process.cwd();
const destination = path.join(root, "public/document-assets");
const copies = [
  ["pdfjs-dist/build/pdf.worker.min.mjs", "pdf/pdf.worker.min.mjs"],
  ["pdfjs-dist/cmaps", "pdf/cmaps"],
  ["pdfjs-dist/standard_fonts", "pdf/standard_fonts"],
  ["pdfjs-dist/wasm", "pdf/wasm"],
  ["tesseract.js/dist/worker.min.js", "ocr/worker.min.js"],
  ["tesseract.js-core", "ocr/core"],
  ["@tesseract.js-data/vie/4.0.0_best_int/vie.traineddata.gz", "ocr/lang/vie.traineddata.gz"],
  ["@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz", "ocr/lang/eng.traineddata.gz"],
];
for (const [source, target] of copies) {
  const output = path.join(destination, target);
  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.cp(path.join(root, "node_modules", source), output, { recursive: true });
}
console.log("Document reader: local PDF worker, fonts and Vietnamese/English OCR assets ready.");
