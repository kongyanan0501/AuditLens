import { runAnomalyDetection } from "@/server/anomaly";
import { runRuleCheck } from "@/server/rules";
import type {
  AuditAnomaly,
  AuditGraphState,
  AuditIssue,
  AuditRecord,
  IssueType,
  RuleThresholdConfig,
} from "@/types/audit";
import { RISK_SCORE_WEIGHTS } from "@/types/audit";

export type DeterministicAuditResult = {
  issues: AuditIssue[];
  anomalies: AuditAnomaly[];
  score: number;
};

function countByType(issues: AuditIssue[], type: IssueType): number {
  return issues.filter((issue) => issue.type === type).length;
}

/** MVP scoring: docs/init.md §8.4 */
export function computeRiskScore(
  state: Pick<AuditGraphState, "issues" | "anomalies">,
): number {
  const duplicates = countByType(state.issues, "duplicate");
  const missingApproval = countByType(state.issues, "approval");
  const anomalies =
    state.anomalies.length +
    countByType(state.issues, "anomaly") +
    countByType(state.issues, "vendor_concentration");

  const raw =
    100 -
    duplicates * RISK_SCORE_WEIGHTS.duplicate -
    anomalies * RISK_SCORE_WEIGHTS.anomaly -
    missingApproval * RISK_SCORE_WEIGHTS.missingApproval;

  return Math.max(0, Math.min(100, raw));
}

/** 确定性审计入口：规则 + 异常 + 评分，无需 LLM */
export function runDeterministicAudit(
  records: AuditRecord[],
  config?: Partial<RuleThresholdConfig>,
): DeterministicAuditResult {
  const issues = runRuleCheck(records, config);
  const anomalies = runAnomalyDetection(records, config);
  const score = computeRiskScore({ issues, anomalies });

  return { issues, anomalies, score };
}
