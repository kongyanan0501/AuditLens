import { AlertCircle } from "lucide-react";
import { AlertBanner } from "@/components/AlertBanner";
import { IssueTable } from "@/components/IssueTable";
import { PageHeader } from "@/components/PageHeader";
import { ReportActions } from "@/components/ReportActions";
import { ReportViewer } from "@/components/ReportViewer";
import { RiskScoreCard } from "@/components/RiskScoreCard";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/supabase/require-auth";
import { getAuditTaskBundle } from "@/server/audit-queries";
import { notFound } from "next/navigation";

type ReportPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ReportPage({ params }: ReportPageProps) {
  const { id } = await params;
  const user = await requireAuth(`/report/${id}`);

  const supabase = await createClient();
  const bundle = await getAuditTaskBundle(supabase, id, user.id);

  if (!bundle) {
    notFound();
  }

  const llmCount = bundle.issues.filter(
    (issue) => issue.metadata?.llmExplained === true,
  ).length;

  return (
    <section className="space-y-8">
      <PageHeader
        title="审计报告"
        description={`${bundle.task.fileName} · 任务 ID: ${id}`}
      />

      {bundle.task.status === "failed" ? (
        <AlertBanner
          icon={AlertCircle}
          variant="error"
          title="该任务分析失败"
          description="报告可能不完整。请检查源文件格式与必填列后重新上传。"
        />
      ) : null}

      {bundle.task.status === "running" || bundle.task.status === "pending" ? (
        <AlertBanner
          icon={AlertCircle}
          variant="warning"
          title="任务仍在处理中"
          description="分析完成后报告内容将自动更新，请稍后刷新页面。"
        />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <RiskScoreCard
          score={bundle.task.score}
          label="风险评分"
          featured
        />
        <RiskScoreCard
          score={bundle.issues.length}
          label="问题总数"
        />
        <RiskScoreCard
          score={llmCount > 0 ? llmCount : null}
          label="AI 解释"
          description={
            llmCount > 0 ? `${llmCount} 项含 RAG 政策引用与建议` : undefined
          }
        />
      </div>

      {bundle.report?.content ? (
        <ReportActions
          content={bundle.report.content}
          taskId={bundle.task.id}
          fileName={bundle.task.fileName}
        />
      ) : null}

      <ReportViewer content={bundle.report?.content ?? null} />
      <IssueTable issues={bundle.issues} />
    </section>
  );
}
