import { IssueTable } from "@/components/IssueTable";
import { PageHeader } from "@/components/PageHeader";
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

      <ReportViewer content={bundle.report?.content ?? null} />
      <IssueTable issues={bundle.issues} />
    </section>
  );
}
