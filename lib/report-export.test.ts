import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { withExportMetadata } from "@/lib/report-export";

describe("withExportMetadata", () => {
  it("appends task id, operator, and rule version", () => {
    const body = withExportMetadata("# 报告", {
      taskId: "task-123",
      exportedAt: "2026-07-19 12:00:00",
      exportedBy: "auditor@example.com",
      ruleConfigVersion: 3,
      fileName: "demo.csv",
    });

    assert.match(body, /任务号 \| task-123/);
    assert.match(body, /操作人 \| auditor@example.com/);
    assert.match(body, /规则配置版本 \| 3/);
    assert.match(body, /源文件 \| demo.csv/);
  });

  it("shows dash when rule version missing", () => {
    const body = withExportMetadata("# 报告", {
      taskId: "t1",
      exportedAt: "now",
      exportedBy: "u1",
    });
    assert.match(body, /规则配置版本 \| —/);
  });
});
