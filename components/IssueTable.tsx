import type { AuditIssue } from "@/types/audit";

type IssueTableProps = {
  issues: AuditIssue[];
};

const severityLabels: Record<AuditIssue["severity"], string> = {
  low: "低",
  medium: "中",
  high: "高",
};

export function IssueTable({ issues }: IssueTableProps) {
  return (
    <div className="rounded-lg border bg-card">
      <div className="border-b px-4 py-3">
        <h2 className="font-semibold">风险问题</h2>
      </div>
      {issues.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">
          暂无问题记录。上传数据并完成分析后将在此展示。
        </p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-muted/50 text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">类型</th>
              <th className="px-4 py-2 font-medium">严重程度</th>
              <th className="px-4 py-2 font-medium">说明</th>
            </tr>
          </thead>
          <tbody>
            {issues.map((issue, index) => (
              <tr
                key={issue.id ?? `${issue.type}-${index}`}
                className="border-b last:border-0"
              >
                <td className="px-4 py-3">{issue.type}</td>
                <td className="px-4 py-3">
                  {severityLabels[issue.severity]}
                </td>
                <td className="px-4 py-3">{issue.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
