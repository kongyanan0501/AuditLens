import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import { runDeterministicAudit } from "@/server/audit-engine";
import { runAuditGraph } from "@/server/langgraph";
import { parseFinancialFile } from "@/server/parse-excel";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sampleCsvPath = join(__dirname, "../fixtures/sample-audit.csv");

describe("parseFinancialFile", () => {
  it("parses fixture CSV into audit records", () => {
    const content = readFileSync(sampleCsvPath);
    const records = parseFinancialFile("sample-audit.csv", content);

    assert.equal(records.length, 7);
    assert.equal(records[0]?.invoiceId, "INV-001");
    assert.equal(records[0]?.type, "expense");
  });

  it("supports Chinese column headers", () => {
    const csv = [
      "日期,类型,金额,供应商,发票号,审批人",
      "2025-02-01,支出,200,甲公司,A-100,张三",
    ].join("\n");

    const records = parseFinancialFile(
      "demo.csv",
      new TextEncoder().encode(csv),
    );

    assert.equal(records.length, 1);
    assert.equal(records[0]?.vendor, "甲公司");
    assert.equal(records[0]?.type, "expense");
    assert.equal(records[0]?.approvedBy, "张三");
  });
});

describe("runAuditGraph", () => {
  it("runs ParseExcel → RuleCheck → Anomaly → Scoring pipeline", async () => {
    const content = readFileSync(sampleCsvPath);
    const result = await runAuditGraph({
      fileName: "sample-audit.csv",
      fileContent: content,
      taskId: "test-task",
      userId: "test-user",
    });

    assert.equal(result.status, "completed");
    assert.ok(result.records.length > 0);
    assert.ok(result.issues.length > 0);
    assert.ok(result.anomalies.length > 0);
    assert.ok(typeof result.score === "number");
    assert.match(result.report ?? "", /## 执行摘要/);
    assert.match(result.report ?? "", /## 发现项/);
    assert.match(result.report ?? "", /## 风险分析/);
    assert.match(result.report ?? "", /## 整改建议/);
  });

  it("marks failed when file content is empty", async () => {
    const result = await runAuditGraph({
      fileName: "empty.csv",
      fileContent: new Uint8Array(),
    });

    assert.equal(result.status, "failed");
    assert.ok(result.error);
  });
});

describe("fixture end-to-end", () => {
  it("sample CSV produces deterministic score without LLM", () => {
    const content = readFileSync(sampleCsvPath);
    const records = parseFinancialFile("sample-audit.csv", content);
    const audit = runDeterministicAudit(records);

    assert.ok(audit.issues.some((issue) => issue.type === "duplicate"));
    assert.ok(audit.issues.some((issue) => issue.type === "approval"));
    assert.ok(audit.score < 100);
  });
});
