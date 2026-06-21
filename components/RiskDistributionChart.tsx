import { BarChart3 } from "lucide-react";
import type { AuditIssue, IssueType } from "@/types/audit";
import { EmptyState } from "@/components/EmptyState";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { issueTypeChartColor } from "@/lib/theme";

const categories = [
  { label: "重复发票", key: "duplicate" as IssueType },
  { label: "金额异常", key: "anomaly" as IssueType },
  { label: "审批缺失", key: "approval" as IssueType },
  { label: "供应商集中", key: "vendor_concentration" as IssueType },
] as const;

type RiskDistributionChartProps = {
  issues: AuditIssue[];
};

function countByType(issues: AuditIssue[], type: IssueType): number {
  return issues.filter((issue) => issue.type === type).length;
}

export function RiskDistributionChart({ issues }: RiskDistributionChartProps) {
  const counts = categories.map((category) => ({
    ...category,
    count: countByType(issues, category.key),
  }));
  const maxCount = Math.max(...counts.map((entry) => entry.count), 1);
  const hasData = issues.length > 0;

  return (
    <Panel className="flex h-full flex-col overflow-hidden">
      <PanelHeader
        title="风险分布"
        description={
          hasData
            ? `共 ${issues.length} 项，按问题类型统计`
            : "完成分析后将展示各类问题占比"
        }
      />

      <div className="flex flex-1 flex-col">
        <div
          className="flex flex-1 items-end gap-3 px-5 pb-2 pt-8"
          role="img"
          aria-label="风险类型分布柱状图"
        >
          {counts.map((entry) => {
            const heightPercent =
              entry.count > 0
                ? Math.max(12, Math.round((entry.count / maxCount) * 100))
                : 8;

            return (
              <div
                key={entry.key}
                className="flex flex-1 flex-col items-center gap-2"
              >
                <span className="al-metric text-xs font-medium text-foreground">
                  {entry.count > 0 ? entry.count : ""}
                </span>
                <div
                  className="w-full rounded-t-md transition-all"
                  style={{
                    height: `${heightPercent}%`,
                    minHeight: entry.count > 0 ? "2rem" : "0.5rem",
                    backgroundColor: issueTypeChartColor[entry.key],
                    opacity: entry.count > 0 ? 1 : 0.25,
                  }}
                  aria-hidden
                />
                <span className="text-center text-[10px] leading-tight text-muted-foreground">
                  {entry.label}
                </span>
              </div>
            );
          })}
        </div>

        {!hasData ? (
          <EmptyState
            icon={BarChart3}
            title="等待分析数据"
            description="上传 Excel 或 CSV 后，各类风险的分布将在此可视化。"
            className="border-t border-[var(--border-subtle)] py-8"
          />
        ) : null}
      </div>
    </Panel>
  );
}
