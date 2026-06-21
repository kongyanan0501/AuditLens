#!/usr/bin/env node
/**
 * Convert fixture CSV files to Excel (.xlsx) for upload testing.
 * Usage: node scripts/build-fixtures-xlsx.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as XLSX from "xlsx";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, "../fixtures");

const CSV_FILES = [
  "sample-audit.csv",
  "demo-financial-audit.csv",
  "demo-financial-audit-full.csv",
];

for (const csvName of CSV_FILES) {
  const csvPath = join(fixturesDir, csvName);
  const xlsxName = csvName.replace(/\.csv$/i, ".xlsx");
  const xlsxPath = join(fixturesDir, xlsxName);

  const csvText = readFileSync(csvPath, "utf8");
  const workbook = XLSX.read(csvText, { type: "string" });
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  writeFileSync(xlsxPath, buffer);
  console.log(`Wrote ${xlsxName}`);
}
