type ReportViewerProps = {
  content: string | null;
};

export function ReportViewer({ content }: ReportViewerProps) {
  if (!content) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
        报告尚未生成。完成审计任务后将展示 Executive Summary、Findings 与
        Recommendations。
      </div>
    );
  }

  return (
    <article className="prose prose-slate max-w-none rounded-lg border bg-card p-8">
      <pre className="whitespace-pre-wrap font-sans text-sm">{content}</pre>
    </article>
  );
}
