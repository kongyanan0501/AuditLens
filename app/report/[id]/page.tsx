import { ReportViewer } from "@/components/ReportViewer";

type ReportPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ReportPage({ params }: ReportPageProps) {
  const { id } = await params;

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary">审计报告</h1>
        <p className="text-sm text-muted-foreground">任务 ID: {id}</p>
      </div>
      <ReportViewer content={null} />
    </section>
  );
}
