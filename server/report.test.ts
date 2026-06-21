import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import { runDeterministicAudit } from "@/server/audit-engine";
import { parseFinancialFile } from "@/server/parse-excel";
import {
  buildDeterministicReport,
  buildExecutiveSummary,
  buildFindingsSection,
} from "@/server/report";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sampleCsvPath = join(__dirname, "../fixtures/sample-audit.csv");

describe("buildDeterministicReport", () => {
  it("includes all required markdown sections", () => {
    const content = readFileSync(sampleCsvPath);
    const records = parseFinancialFile("sample-audit.csv", content);
    const audit = runDeterministicAudit(records);

    const report = buildDeterministicReport({
      fileName: "sample-audit.csv",
      records,
      issues: audit.issues,
      anomalies: audit.anomalies,
      score: audit.score,
      explanations: [],
    });

    assert.match(report, /## 执行摘要/);
    assert.match(report, /## 发现项/);
    assert.match(report, /## 风险分析/);
    assert.match(report, /## 整改建议/);
    assert.match(report, /综合风险评分/);
  });

  it("summarizes findings by issue type", () => {
    const summary = buildExecutiveSummary({
      fileName: "demo.csv",
      records: [{ date: "2025-01-01", type: "expense", amount: 100, vendor: "A", invoiceId: "X" }],
      issues: [
        {
          type: "duplicate",
          severity: "high",
          reason: "重复发票 INV-001",
        },
      ],
      anomalies: [],
      score: 90,
    });

    assert.match(summary, /1.*项风险信号/);
    assert.match(summary, /1.*项高风险/);
  });

  it("lists grouped findings", () => {
    const section = buildFindingsSection({
      issues: [
        {
          type: "approval",
          severity: "medium",
          reason: "缺少审批",
        },
      ],
      anomalies: [],
    });

    assert.match(section, /审批缺失/);
    assert.match(section, /缺少审批/);
  });
});
