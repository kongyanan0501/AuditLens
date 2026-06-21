import Link from "next/link";
import { FileText, Upload } from "lucide-react";
import { IssueTable } from "@/components/IssueTable";
import {
  PageHeader,
  PageHeaderLinkAction,
} from "@/components/PageHeader";
import { RiskDistributionChart } from "@/components/RiskDistributionChart";
import { RiskScoreCard } from "@/components/RiskScoreCard";
import { Button } from "@/components/ui/button";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/supabase/require-auth";
import { getRiskLabel } from "@/lib/theme";
import { cn } from "@/lib/utils";
import {
  getAuditTaskBundle,
  getLatestCompletedTaskBundle,
  listUserAuditTasks,
} from "@/server/audit-queries";

type DashboardPageProps = {
  searchParams: Promise<{ taskId?: string }>;
};

const statusLabels: Record<string, string> = {
  pending: "待处理",
  running: "分析中",
  completed: "已完成",
  failed: "失败",
};

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const user = await requireAuth("/dashboard");
  const { taskId } = await searchParams;

  const supabase = await createClient();
  const [recentTasks, bundleFromQuery] = await Promise.all([
    listUserAuditTasks(supabase, user.id, 8),
    taskId
      ? getAuditTaskBundle(supabase, taskId, user.id)
      : getLatestCompletedTaskBundle(supabase, user.id),
  ]);

  const activeTaskId = taskId ?? bundleFromQuery?.task.id;
  const bundle = bundleFromQuery;

  const issues = bundle?.issues ?? [];
  const score = bundle?.task.score ?? null;
  const highCount = issues.filter((issue) => issue.severity === "high").length;
  const llmCount = issues.filter(
    (issue) => issue.metadata?.llmExplained === true,
  ).length;

  return (
    <section className="space-y-8">
      <PageHeader
        title="审计仪表盘"
        description={
          bundle
            ? `任务「${bundle.task.fileName}」分析结果 · ${getRiskLabel(score)}`
            : "风险概览与问题追踪。上传数据并完成分析后，结果将在此展示。"
        }
        action={
          <PageHeaderLinkAction href="/upload">
            <Upload className="size-4" aria-hidden />
            上传分析
          </PageHeaderLinkAction>
        }
      />

      {taskId && !bundle ? (
        <p className="text-sm text-destructive" role="alert">
          未找到该任务，请确认链接有效或重新上传分析。
        </p>
      ) : null}

      {recentTasks.length > 0 ? (
        <Panel className="overflow-hidden">
          <PanelHeader
            title="最近任务"
            description="选择任务查看对应风险评分与问题列表"
          />
          <ul className="divide-y divide-[var(--border-subtle)]">
            {recentTasks.map((task) => {
              const isActive = task.id === activeTaskId;
              return (
                <li key={task.id}>
                  <Link
                    href={`/dashboard?taskId=${task.id}`}
                    className={cn(
                      "flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 text-sm transition-colors hover:bg-muted/30",
                      isActive && "bg-primary/5",
                    )}
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{task.fileName}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(task.createdAt).toLocaleString("zh-CN")}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 font-medium",
                          task.status === "completed" &&
                            "bg-success/15 text-success",
                          task.status === "failed" &&
                            "bg-destructive/15 text-destructive",
                          task.status === "running" &&
                            "bg-primary/10 text-primary",
                          task.status === "pending" &&
                            "bg-muted text-muted-foreground",
                        )}
                      >
                        {statusLabels[task.status] ?? task.status}
                      </span>
                      {task.score !== null ? (
                        <span className="al-metric font-medium">
                          评分 {task.score}
                        </span>
                      ) : null}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Panel>
      ) : null}

      {bundle ? (
        <div className="flex flex-wrap items-center gap-3">
          {bundle.report ? (
            <Button asChild size="sm" variant="outline">
              <Link href={`/report/${bundle.task.id}`}>
                <FileText className="size-4" aria-hidden />
                查看报告
              </Link>
            </Button>
          ) : null}
          <p className="text-xs text-muted-foreground">
            任务 ID：{bundle.task.id}
          </p>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <RiskScoreCard
          score={score}
          label="综合风险评分"
          description={
            bundle ? `状态：${statusLabels[bundle.task.status] ?? bundle.task.status}` : "尚无已完成任务"
          }
          featured
        />
        <RiskScoreCard
          score={issues.length > 0 ? issues.length : null}
          label="发现问题"
          description={bundle ? `共 ${issues.length} 项` : "上传数据后统计"}
        />
        <RiskScoreCard
          score={highCount > 0 ? highCount : null}
          label="高风险项"
          variant="danger"
          description={
            bundle ? `${highCount} 项需优先复核` : "高风险 issue 数量"
          }
        />
        <RiskScoreCard
          score={llmCount > 0 ? llmCount : null}
          label="AI 解释"
          variant="warning"
          description={
            bundle
              ? llmCount > 0
                ? `${llmCount} 项已生成 RAG 解释`
                : "无高风险项或未配置 LLM"
              : "RAG 增强说明数量"
          }
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <RiskDistributionChart issues={issues} />
        </div>
        <div className="lg:col-span-3">
          <IssueTable issues={issues} />
        </div>
      </div>

      {!bundle ? (
        <p className="text-center text-xs text-muted-foreground md:hidden">
          <Link href="/upload" className="text-primary hover:underline">
            前往上传页面开始首次分析
          </Link>
        </p>
      ) : null}
    </section>
  );
}
