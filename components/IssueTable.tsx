import Link from "next/link";
import { ClipboardList } from "lucide-react";
import type { AuditIssue, IssueSeverity, IssueType } from "@/types/audit";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { cn } from "@/lib/utils";

type IssueTableProps = {
  issues: AuditIssue[];
};

const severityLabels: Record<IssueSeverity, string> = {
  low: "低",
  medium: "中",
  high: "高",
};

const typeLabels: Record<IssueType, string> = {
  duplicate: "重复发票",
  anomaly: "金额异常",
  approval: "审批缺失",
  vendor_concentration: "供应商集中",
};

const severityStyles: Record<IssueSeverity, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-warning/15 text-warning",
  high: "bg-destructive/15 text-destructive",
};

export function IssueTable({ issues }: IssueTableProps) {
  return (
    <Panel className="overflow-hidden">
      <PanelHeader
        title="风险问题"
        description="规则引擎与异常检测发现的问题列表"
      />

      {issues.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="暂无问题记录"
          description="上传财务数据并完成分析后，检测到的问题将在此列出。"
          action={
            <Button asChild size="sm">
              <Link href="/upload">上传数据</Link>
            </Button>
          }
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead className="border-b border-[var(--border-subtle)] bg-surface-2/50 text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">类型</th>
                <th className="px-5 py-3 font-medium">严重程度</th>
                <th className="px-5 py-3 font-medium">说明</th>
              </tr>
            </thead>
            <tbody>
              {issues.map((issue, index) => (
                <tr
                  key={issue.id ?? `${issue.type}-${index}`}
                  className="border-b border-[var(--border-subtle)] transition-colors last:border-0 hover:bg-muted/30"
                >
                  <td className="px-5 py-3.5 font-medium">
                    {typeLabels[issue.type]}
                  </td>
                  <td className="px-5 py-3.5">
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
                        severityStyles[issue.severity],
                      )}
                    >
                      {severityLabels[issue.severity]}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-muted-foreground">
                    {issue.reason}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
