import { RiskScoreCard } from "@/components/RiskScoreCard";
import { IssueTable } from "@/components/IssueTable";
import { requireAuth } from "@/lib/supabase/require-auth";

export default async function DashboardPage() {
  await requireAuth("/dashboard");

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary">审计仪表盘</h1>
        <p className="text-sm text-muted-foreground">风险概览与问题追踪</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <RiskScoreCard score={null} />
        <RiskScoreCard score={85} label="最近任务" />
        <RiskScoreCard score={62} label="高风险任务" variant="warning" />
      </div>
      <IssueTable issues={[]} />
    </section>
  );
}
