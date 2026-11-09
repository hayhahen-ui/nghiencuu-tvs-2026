import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { readDocx, readSpreadsheet } from "../src/lib/office-reader";
import { analyzeMsds, isValidCasNumber } from "../src/lib/msds-analyzer";
import { completeDocument } from "../src/lib/research-documents";

test("CAS checksum validation works correctly", () => {
  assert.equal(isValidCasNumber("64-17-5"), true, "Ethanol CAS should be valid");
  assert.equal(isValidCasNumber("67-63-0"), true, "IPA CAS should be valid");
  assert.equal(isValidCasNumber("7664-93-9"), true, "H2SO4 CAS should be valid");
  assert.equal(isValidCasNumber("64-17-9"), false, "Corrupted CAS should fail checksum");
});

test("Parses standard 16-section MSDS DOCX and extracts chemical safety parameters", () => {
  const docxPath = "public/samples/MSDS_Ethanol_99.5_GHS_VN_EN.docx";
  const bytes = new Uint8Array(fs.readFileSync(docxPath));

  const docResult = readDocx(bytes);
  assert.ok(docResult.units.length > 0, "Docx should produce units");

  const fullDoc = completeDocument({
    id: "test-msds-docx-0000000000000000",
    name: "MSDS_Ethanol_99.5_GHS_VN_EN.docx",
    format: "docx",
    size: bytes.length,
    importedAt: new Date().toISOString(),
    unitCount: docResult.unitCount,
    processedCount: docResult.unitCount,
    units: docResult.units,
    warnings: docResult.warnings,
  });

  const analysis = analyzeMsds(fullDoc);

  assert.equal(analysis.isMsds, true, "Should be detected as MSDS");
  assert.ok(analysis.confidenceScore >= 80, `High confidence score expected, got ${analysis.confidenceScore}`);
  assert.ok(analysis.chemical.casNumbers.includes("64-17-5"), "Should find CAS 64-17-5 for Ethanol");
  assert.ok(analysis.chemical.unNumbers.some((un) => un.includes("1170")), "Should find UN 1170");
  assert.equal(analysis.chemical.signalWord, "NGUY HIỂM", "Signal word should be NGUY HIỂM or DANGER");

  // Check H and P codes
  const hCodes = analysis.chemical.hazardCodes.map((h) => h.code);
  assert.ok(hCodes.includes("H225"), "Should find H225");
  assert.ok(hCodes.includes("H319"), "Should find H319");

  const pCodes = analysis.chemical.precautionaryCodes.map((p) => p.code);
  assert.ok(pCodes.includes("P210"), "Should find P210");
  assert.ok(pCodes.includes("P280"), "Should find P280");

  // Check physical properties
  assert.ok(analysis.chemical.physicalProperties.boilingPoint?.includes("78"), "Boiling point should be detected");
  assert.ok(analysis.chemical.physicalProperties.flashPoint?.includes("13"), "Flash point should be detected");

  // Check 16 sections
  const secKeys = Object.keys(analysis.sections);
  assert.equal(secKeys.length, 16, "Must define all 16 GHS sections");
  const foundSections = Object.values(analysis.sections).filter((s) => s.found);
  assert.ok(foundSections.length >= 14, `Expected at least 14/16 sections found in sample, got ${foundSections.length}`);
});

test("Parses Chemical Inventory Excel XLSX and recognizes multiple SDS rows and CAS numbers", async () => {
  const xlsxPath = "public/samples/Chemical_Inventory_MSDS_Matrix.xlsx";
  const bytes = new Uint8Array(fs.readFileSync(xlsxPath));

  const excelResult = await readSpreadsheet(bytes, "xlsx");
  assert.ok(excelResult.units.length > 0, "Excel should produce text units");

  const fullDoc = completeDocument({
    id: "test-msds-xlsx-0000000000000000",
    name: "Chemical_Inventory_MSDS_Matrix.xlsx",
    format: "xlsx",
    size: bytes.length,
    importedAt: new Date().toISOString(),
    unitCount: excelResult.unitCount,
    processedCount: excelResult.unitCount,
    units: excelResult.units,
    warnings: excelResult.warnings,
  });

  const analysis = analyzeMsds(fullDoc);
  assert.equal(analysis.isMsds, true, "Excel chemical inventory should be detected as MSDS");
  assert.ok(analysis.chemical.casNumbers.includes("64-17-5"), "Should find CAS 64-17-5");
  assert.ok(analysis.chemical.casNumbers.includes("7664-93-9"), "Should find CAS 7664-93-9 for H2SO4");
  assert.ok(analysis.chemical.casNumbers.includes("67-63-0"), "Should find CAS 67-63-0 for IPA");
});
