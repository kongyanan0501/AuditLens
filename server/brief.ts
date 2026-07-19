import { getRiskLabel } from "@/lib/theme";
import type {
  AuditIssue,
  IssueSeverity,
  IssueType,
} from "@/types/audit";
import { RISK_SCORE_WEIGHTS } from "@/types/audit";

const TYPE_LABELS: Record<IssueType, string> = {
  duplicate: "重复发票",
  anomaly: "金额异常",
  approval: "审批缺失",
  vendor_concentration: "供应商集中",
};

const SEVERITY_RANK: Record<IssueSeverity, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

export type ExecutiveBriefAction = {
  type: IssueType;
  severity: IssueSeverity;
  summary: string;
  recommendation?: string;
};

export type ExecutiveBriefModel = {
  score: number | null;
  tierLabel: string;
  issueCount: number;
  highCount: number;
  scoreNarrative: string;
  topActions: ExecutiveBriefAction[];
};

function countByType(issues: AuditIssue[], type: IssueType): number {
  return issues.filter((issue) => issue.type === type).length;
}

function buildScoreNarrative(issues: AuditIssue[], score: number | null): string {
  if (issues.length === 0) {
    return "未发现显著风险信号，建议保持现有内控抽检节奏。";
  }

  const drivers = (
    [
      {
        type: "duplicate" as const,
        weight: RISK_SCORE_WEIGHTS.duplicate,
        count: countByType(issues, "duplicate"),
      },
      {
        type: "approval" as const,
        weight: RISK_SCORE_WEIGHTS.missingApproval,
        count: countByType(issues, "approval"),
      },
      {
        type: "anomaly" as const,
        weight: RISK_SCORE_WEIGHTS.anomaly,
        count:
          countByType(issues, "anomaly") +
          countByType(issues, "vendor_concentration"),
      },
    ] satisfies Array<{ type: IssueType; weight: number; count: number }>
  )
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.count * b.weight - a.count * a.weight);

  if (drivers.length === 0) {
    return `综合风险评分 ${score ?? "—"}，请复核下方问题清单。`;
  }

  const labels = drivers
    .slice(0, 2)
    .map((entry) => TYPE_LABELS[entry.type])
    .join("与");

  return `扣分主要来自${labels}，建议优先完成高风险项复核与整改闭环。`;
}

export function buildExecutiveBrief(input: {
  score: number | null;
  issues: AuditIssue[];
}): ExecutiveBriefModel {
  const sorted = [...input.issues].sort(
    (a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity],
  );

  const highCount = input.issues.filter(
    (issue) => issue.severity === "high",
  ).length;

  const topActions = sorted.slice(0, 3).map((issue) => {
    const recommendation =
      typeof issue.metadata?.recommendation === "string"
        ? issue.metadata.recommendation
        : undefined;

    return {
      type: issue.type,
      severity: issue.severity,
      summary: issue.reason,
      ...(recommendation ? { recommendation } : {}),
    };
  });

  return {
    score: input.score,
    tierLabel: getRiskLabel(input.score),
    issueCount: input.issues.length,
    highCount,
    scoreNarrative: buildScoreNarrative(input.issues, input.score),
    topActions,
  };
}
