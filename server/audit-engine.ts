import type { AuditGraphState, AuditIssue, IssueType } from "@/types/audit";
import { RISK_SCORE_WEIGHTS } from "@/types/audit";

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
