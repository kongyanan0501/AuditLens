import Link from "next/link";
import { Upload } from "lucide-react";
import { IssueTable } from "@/components/IssueTable";
import {
  PageHeader,
  PageHeaderLinkAction,
} from "@/components/PageHeader";
import { RiskChartPlaceholder } from "@/components/RiskChartPlaceholder";
import { RiskScoreCard } from "@/components/RiskScoreCard";
import { requireAuth } from "@/lib/supabase/require-auth";

export default async function DashboardPage() {
  await requireAuth("/dashboard");

  return (
    <section className="space-y-8">
      <PageHeader
        title="审计仪表盘"
        description="风险概览与问题追踪。综合评分与问题分布将随分析任务自动更新。"
        action={
          <PageHeaderLinkAction href="/upload">
            <Upload className="size-4" aria-hidden />
            上传分析
          </PageHeaderLinkAction>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <RiskScoreCard
          score={null}
          label="综合风险评分"
          description="尚无已完成任务"
          featured
        />
        <RiskScoreCard score={85} label="最近任务" description="示例占位数据" />
        <RiskScoreCard
          score={62}
          label="高风险任务"
          variant="warning"
          description="评分低于 80 需关注"
        />
        <RiskScoreCard
          score={42}
          label="最低评分"
          variant="danger"
          description="需优先复核"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <RiskChartPlaceholder />
        </div>
        <div className="lg:col-span-3">
          <IssueTable issues={[]} />
        </div>
      </div>

      <p className="text-center text-xs text-muted-foreground md:hidden">
        <Link href="/upload" className="text-primary hover:underline">
          前往上传页面开始首次分析
        </Link>
      </p>
    </section>
  );
}
