import { z } from "zod";
import { analyzeMsds } from "./msds-analyzer";

export const MAX_DOCUMENT_BYTES = 30 * 1024 * 1024;
export const MAX_DOCUMENT_CHARS = 2_000_000;
export const MAX_DOCUMENTS = 20;
export const DOCUMENT_EVIDENCE_CHARS = 120_000;
export type DocumentFormat = "pdf" | "docx" | "doc" | "xlsx" | "xls" | "csv";
export type DocumentUnit = {
  id: string;
  locator: string;
  text: string;
  method: "text" | "ocr";
  confidence?: number;
};
export type ResearchDocument = {
  id: string;
  name: string;
  format: DocumentFormat;
  size: number;
  importedAt: string;
  unitCount: number;
  processedCount: number;
  units: DocumentUnit[];
  warnings: string[];
};
export type StoredDocument = ResearchDocument & { original: Blob };
export type EvidenceDocument = {
  id: string; name: string; format: DocumentFormat; totalUnits: number;
  warnings: string[]; units: DocumentUnit[];
};
export type EvidenceReceipt = {
  documents: number; totalUnits: number; includedUnits: number; characters: number;
  sources: { id: string; name: string; units: { id: string; locator: string }[] }[];
};

const unitSchema = z.object({
  id: z.string().regex(/^u[0-9]+$/),
  locator: z.string().min(1).max(300),
  text: z.string().max(6000),
  method: z.enum(["text", "ocr"]),
  confidence: z.number().min(0).max(100).nullish().transform((v) => (v ?? undefined)),
});
export const evidenceSchema = z.array(z.object({
  id: z.string().regex(/^[a-f0-9]{32}$/),
  name: z.string().min(1).max(300),
  format: z.enum(["pdf", "docx", "doc", "xlsx", "xls", "csv"]),
  totalUnits: z.number().int().min(1).max(3000),
  warnings: z.array(z.string().max(500)).max(100),
  units: z.array(unitSchema).min(1).max(3000),
})).max(MAX_DOCUMENTS).superRefine((documents, ctx) => {
  let characters = 0;
  const ids = new Set<string>();
  for (const doc of documents) {
    if (ids.has(doc.id) || new Set(doc.units.map((u) => u.id)).size !== doc.units.length || doc.units.length > doc.totalUnits)
      ctx.addIssue({ code: "custom", message: "Nguồn tài liệu trùng hoặc số đoạn không hợp lệ." });
    ids.add(doc.id);
    characters += doc.units.reduce((n, u) => n + u.text.length, 0);
  }
  if (characters > DOCUMENT_EVIDENCE_CHARS)
    ctx.addIssue({ code: "custom", message: "Ngữ cảnh tài liệu vượt dung lượng cho phép." });
});

function sanitizeConfidence(confidence: unknown): number | undefined {
  if (typeof confidence !== "number" || !Number.isFinite(confidence)) return undefined;
  return Math.min(100, Math.max(0, confidence));
}

export function splitDocumentText(text: string, locator: string, method: DocumentUnit["method"] = "text", confidence?: number): Omit<DocumentUnit, "id">[] {
  const safeConfidence = sanitizeConfidence(confidence);
  const safeLocator = locator.slice(0, 300) || "Đoạn";
  const clean = text.replace(/\u0000/g, "").replace(/\r\n/g, "\n").trim();
  if (!clean) return [{ locator: safeLocator, text: "", method, ...(safeConfidence === undefined ? {} : { confidence: safeConfidence }) }];
  const parts: string[] = [];
  let remaining = clean;
  while (remaining.length > 6000) {
    const newline = remaining.lastIndexOf("\n", 6000);
    const end = newline >= 3000 ? newline + 1 : 6000;
    parts.push(remaining.slice(0, end));
    remaining = remaining.slice(end);
  }
  if (remaining) parts.push(remaining);
  return parts.map((part, i) => ({
    locator: (safeLocator + (parts.length > 1 ? ` · phần ${i + 1}/${parts.length}` : "")).slice(0, 300),
    text: part, method, ...(safeConfidence === undefined ? {} : { confidence: safeConfidence }),
  }));
}

export function completeDocument(document: Omit<ResearchDocument, "units"> & { units: Omit<DocumentUnit, "id">[] }): ResearchDocument {
  if (document.units.length > 3000 || document.units.reduce((n, u) => n + u.text.length, 0) > MAX_DOCUMENT_CHARS)
    throw new Error("Tài liệu vượt giới hạn 2 triệu ký tự hoặc 3.000 đoạn. Hãy chia file; ứng dụng không cắt bỏ nội dung âm thầm.");
  if (!document.units.some((u) => u.text.trim())) throw new Error("Không trích được chữ. Thử OCR với PDF scan hoặc lưu lại tài liệu không mã hóa.");
  return { ...document, units: document.units.map((unit, i) => ({ ...unit, id: `u${i + 1}` })) };
}

function normalize(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/đ/g, "d");
}
// Read/store every unit locally; rank only when the chosen sources exceed an AI request's budget.
export function selectDocumentEvidence(documents: ResearchDocument[], query: string): EvidenceDocument[] {
  const tokens = [...new Set(normalize(query).match(/[a-z0-9][a-z0-9.-]{1,}/g) || [])];
  const isChem = /msds|sds|hoa chat|an toan|nguy hai|cas|un|doc tinh|chay|bao quan|so cuu|tuong ky|ppe/i.test(normalize(query));
  const ranked = documents.flatMap((doc) => doc.units.map((unit, order) => {
    const text = normalize(unit.text);
    const title = normalize(doc.name);
    const chemBonus = isChem && (/\b[1-9][0-9]{1,6}-\d{2}-\d\b/.test(unit.text) || /\b(ghs|h[2-4][0-9]{2}|p[1-5][0-9]{2})\b/i.test(unit.text)) ? 6 : 0;
    const score = chemBonus + tokens.reduce((n, token) => n + (title.includes(token) ? 4 : 0) +
      Math.min(8, text.split(token).length - 1) * (/[0-9]/.test(token) ? 3 : 1), 0);
    return { doc, unit, order, score };
  }));
  const selected = new Map<string, Set<string>>();
  let characters = 0;
  const take = (entry: typeof ranked[number]) => {
    const ids = selected.get(entry.doc.id) || new Set<string>();
    if (ids.has(entry.unit.id) || characters + entry.unit.text.length > DOCUMENT_EVIDENCE_CHARS) return;
    characters += entry.unit.text.length; ids.add(entry.unit.id); selected.set(entry.doc.id, ids);
  };
  // Each enabled file contributes at least its most relevant unit, without starving later files.
  for (const doc of documents) {
    const best = ranked.filter((entry) => entry.doc.id === doc.id).sort((a, b) => b.score - a.score || a.order - b.order)[0];
    if (best) take(best);
  }
  for (const entry of ranked.sort((a, b) => b.score - a.score || a.order - b.order)) take(entry);
  return documents.slice(0, MAX_DOCUMENTS).map((doc) => {
    const safeUnits = doc.units
      .filter((u) => selected.get(doc.id)?.has(u.id))
      .slice(0, 3000)
      .map((u) => {
        const safeConfidence = sanitizeConfidence(u.confidence);
        return {
          id: u.id,
          locator: (u.locator || "Đoạn").slice(0, 300),
          text: (u.text || "").slice(0, 6000),
          method: u.method === "ocr" ? ("ocr" as const) : ("text" as const),
          ...(safeConfidence === undefined ? {} : { confidence: safeConfidence }),
        };
      });
    return {
      id: doc.id,
      name: (doc.name || "Tài liệu").slice(0, 300),
      format: doc.format,
      totalUnits: Math.min(3000, Math.max(doc.units.length, safeUnits.length, 1)),
      warnings: (Array.isArray(doc.warnings) ? doc.warnings : [])
        .filter((w): w is string => typeof w === "string")
        .slice(0, 100)
        .map((w) => w.slice(0, 500)),
      units: safeUnits,
    };
  }).filter((doc) => doc.units.length);
}

export function documentEvidenceContext(documents: EvidenceDocument[]): { text: string; info: EvidenceReceipt } {
  const sources = documents.map((doc) => ({ id: doc.id, name: doc.name, units: doc.units.map(({ id, locator }) => ({ id, locator })) }));
  const text = documents.map((doc) => {
    let msdsSummary = "";
    try {
      const analysis = analyzeMsds({
        id: doc.id,
        name: doc.name,
        format: doc.format,
        size: 0,
        importedAt: "",
        unitCount: doc.totalUnits,
        processedCount: doc.units.length,
        units: doc.units,
        warnings: doc.warnings,
      });
      if (analysis.isMsds) {
        msdsSummary = `\n\n[DỮ LIỆU AN TOÀN HÓA CHẤT GHS ĐÃ CHUẨN HÓA TỰ ĐỘNG CHO TRỢ LÝ]:\n${analysis.summaryText}`;
      }
    } catch {}

    return [
      `TÀI LIỆU NGƯỜI DÙNG: ${JSON.stringify(doc.name)} · ${doc.units.length}/${doc.totalUnits} đoạn đã cung cấp.${msdsSummary}`,
      ...(doc.warnings.length ? [`Lưu ý trích xuất: ${doc.warnings.join("; ")}`] : []),
      ...doc.units.map((unit) => `Nguồn: ${JSON.stringify(doc.name)} · ${unit.locator}${unit.method === "ocr" ? " (OCR, cần đối chiếu số liệu với bản gốc)" : ""}\nTrích dẫn bằng liên kết [tên file, ${unit.locator}](#source/${doc.id}/${unit.id})\n${unit.text || "[Trang/đoạn không có chữ trích xuất được]"}`),
    ].join("\n\n");
  }).join("\n\n");
  return { text, info: {
    documents: documents.length,
    totalUnits: documents.reduce((n, doc) => n + doc.totalUnits, 0),
    includedUnits: documents.reduce((n, doc) => n + doc.units.length, 0),
    characters: documents.reduce((n, doc) => n + doc.units.reduce((m, unit) => m + unit.text.length, 0), 0),
    sources,
  } };
}
