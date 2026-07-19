"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, ClipboardList } from "lucide-react";
import type {
  AuditIssue,
  EvidenceRow,
  IssueSeverity,
  IssueType,
} from "@/types/audit";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { cn } from "@/lib/utils";

type IssueWorkbenchProps = {
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

const SEVERITY_RANK: Record<IssueSeverity, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

function parseEvidence(metadata: Record<string, unknown> | undefined): EvidenceRow[] {
  const raw = metadata?.evidence;
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw.flatMap((entry) => {
    if (!entry || typeof entry !== "object") {
      return [];
    }
    const row = entry as Record<string, unknown>;
    if (
      typeof row.date !== "string" ||
      (row.type !== "income" && row.type !== "expense") ||
      typeof row.amount !== "number" ||
      typeof row.vendor !== "string" ||
      typeof row.invoiceId !== "string"
    ) {
      return [];
    }
    return [
      {
        date: row.date,
        type: row.type,
        amount: row.amount,
        vendor: row.vendor,
        invoiceId: row.invoiceId,
        ...(typeof row.approvedBy === "string"
          ? { approvedBy: row.approvedBy }
          : {}),
      },
    ];
  });
}

export function IssueWorkbench({ issues }: IssueWorkbenchProps) {
  const [severityFilter, setSeverityFilter] = useState<"all" | IssueSeverity>(
    "all",
  );
  const [typeFilter, setTypeFilter] = useState<"all" | IssueType>("all");
  const [llmOnly, setLlmOnly] = useState(false);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return [...issues]
      .filter((issue) =>
        severityFilter === "all" ? true : issue.severity === severityFilter,
      )
      .filter((issue) =>
        typeFilter === "all" ? true : issue.type === typeFilter,
      )
      .filter((issue) =>
        llmOnly ? issue.metadata?.llmExplained === true : true,
      )
      .sort(
        (a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity],
      );
  }, [issues, severityFilter, typeFilter, llmOnly]);

  return (
    <Panel className="overflow-hidden">
      <PanelHeader
        title="问题工作台"
        description="筛选高风险项并展开关联凭证证据链"
      />

      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border-subtle)] px-5 py-3">
        <select
          className="rounded-md border border-[var(--border-subtle)] bg-background px-2 py-1.5 text-xs"
          value={severityFilter}
          onChange={(event) =>
            setSeverityFilter(event.target.value as "all" | IssueSeverity)
          }
          aria-label="按严重程度筛选"
        >
          <option value="all">全部严重程度</option>
          <option value="high">高</option>
          <option value="medium">中</option>
          <option value="low">低</option>
        </select>

        <select
          className="rounded-md border border-[var(--border-subtle)] bg-background px-2 py-1.5 text-xs"
          value={typeFilter}
          onChange={(event) =>
            setTypeFilter(event.target.value as "all" | IssueType)
          }
          aria-label="按类型筛选"
        >
          <option value="all">全部类型</option>
          {(Object.keys(typeLabels) as IssueType[]).map((type) => (
            <option key={type} value={type}>
              {typeLabels[type]}
            </option>
          ))}
        </select>

        <label className="ml-1 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={llmOnly}
            onChange={(event) => setLlmOnly(event.target.checked)}
          />
          仅 AI 解释
        </label>

        <span className="ml-auto text-xs text-muted-foreground">
          {filtered.length} / {issues.length} 项
        </span>
      </div>

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
      ) : filtered.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">
          当前筛选条件下无匹配问题
        </p>
      ) : (
        <div className="divide-y divide-[var(--border-subtle)]">
          {filtered.map((issue, index) => {
            const key = issue.id ?? `${issue.type}-${index}`;
            const expanded = expandedKey === key;
            const evidence = parseEvidence(issue.metadata);
            const llmExplained = issue.metadata?.llmExplained === true;
            const recommendation =
              typeof issue.metadata?.recommendation === "string"
                ? issue.metadata.recommendation
                : undefined;
            const ruleReference =
              typeof issue.metadata?.ruleReference === "string"
                ? issue.metadata.ruleReference
                : undefined;

            return (
              <div key={key}>
                <button
                  type="button"
                  className="flex w-full items-start gap-3 px-5 py-3.5 text-left transition-colors hover:bg-muted/30"
                  onClick={() =>
                    setExpandedKey((current) => (current === key ? null : key))
                  }
                  aria-expanded={expanded}
                >
                  <ChevronDown
                    className={cn(
                      "mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform",
                      expanded && "rotate-180",
                    )}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">
                        {typeLabels[issue.type]}
                      </span>
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
                          severityStyles[issue.severity],
                        )}
                      >
                        {severityLabels[issue.severity]}
                      </span>
                      {llmExplained ? (
                        <span className="inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                          AI 解释
                        </span>
                      ) : null}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {issue.reason}
                    </p>
                  </div>
                </button>

                {expanded ? (
                  <div className="space-y-3 bg-muted/20 px-5 pb-4 pl-12">
                    {ruleReference ? (
                      <p className="text-xs">
                        <span className="font-medium text-foreground">
                          政策依据：
                        </span>
                        <span className="text-muted-foreground">
                          {ruleReference}
                        </span>
                      </p>
                    ) : null}
                    {recommendation ? (
                      <p className="text-xs">
                        <span className="font-medium text-foreground">
                          整改建议：
                        </span>
                        <span className="text-muted-foreground">
                          {recommendation}
                        </span>
                      </p>
                    ) : null}

                    {evidence.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        无关联明细快照（旧任务或该项无行级索引）
                      </p>
                    ) : (
                      <div className="overflow-x-auto rounded-md border border-[var(--border-subtle)]">
                        <table className="w-full min-w-[520px] text-left text-xs">
                          <thead className="bg-surface-2/50 text-muted-foreground">
                            <tr>
                              <th className="px-3 py-2 font-medium">日期</th>
                              <th className="px-3 py-2 font-medium">类型</th>
                              <th className="px-3 py-2 font-medium">金额</th>
                              <th className="px-3 py-2 font-medium">供应商</th>
                              <th className="px-3 py-2 font-medium">发票号</th>
                              <th className="px-3 py-2 font-medium">审批人</th>
                            </tr>
                          </thead>
                          <tbody>
                            {evidence.map((row, rowIndex) => (
                              <tr
                                key={`${row.invoiceId}-${rowIndex}`}
                                className="border-t border-[var(--border-subtle)]"
                              >
                                <td className="px-3 py-2">{row.date}</td>
                                <td className="px-3 py-2">
                                  {row.type === "expense" ? "支出" : "收入"}
                                </td>
                                <td className="px-3 py-2 al-metric">
                                  {row.amount}
                                </td>
                                <td className="px-3 py-2">{row.vendor}</td>
                                <td className="px-3 py-2">{row.invoiceId}</td>
                                <td className="px-3 py-2">
                                  {row.approvedBy?.trim() || "—"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}
