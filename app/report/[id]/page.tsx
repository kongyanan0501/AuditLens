import { ReportViewer } from "@/components/ReportViewer";
import { PageHeader } from "@/components/PageHeader";
import { requireAuth } from "@/lib/supabase/require-auth";

type ReportPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ReportPage({ params }: ReportPageProps) {
  const { id } = await params;
  await requireAuth(`/report/${id}`);

  return (
    <section className="space-y-8">
      <PageHeader
        title="审计报告"
        description={`任务 ID: ${id}`}
      />
      <ReportViewer content={null} />
    </section>
  );
}
