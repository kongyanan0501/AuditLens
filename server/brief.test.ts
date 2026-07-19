import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildExecutiveBrief } from "@/server/brief";
import type { AuditIssue } from "@/types/audit";

describe("buildExecutiveBrief", () => {
  it("returns empty topActions and positive narrative when no issues", () => {
    const brief = buildExecutiveBrief({ score: 100, issues: [] });
    assert.equal(brief.topActions.length, 0);
    assert.equal(brief.issueCount, 0);
    assert.match(brief.scoreNarrative, /未发现显著风险/);
  });

  it("prioritizes high severity in Top3", () => {
    const issues: AuditIssue[] = [
      { type: "approval", severity: "medium", reason: "缺审批" },
      {
        type: "duplicate",
        severity: "high",
        reason: "重复发票",
        metadata: { recommendation: "核对凭证" },
      },
      { type: "anomaly", severity: "low", reason: "小幅波动" },
      {
        type: "vendor_concentration",
        severity: "high",
        reason: "供应商集中",
      },
    ];

    const brief = buildExecutiveBrief({ score: 62, issues });
    assert.equal(brief.topActions.length, 3);
    assert.equal(brief.topActions[0]?.severity, "high");
    assert.equal(brief.topActions[1]?.severity, "high");
    assert.equal(brief.topActions[0]?.recommendation, "核对凭证");
    assert.equal(brief.highCount, 2);
    assert.match(brief.scoreNarrative, /重复发票|审批缺失|金额异常/);
  });
});
