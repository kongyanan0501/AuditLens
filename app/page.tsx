import Link from "next/link";

export default function HomePage() {
  return (
    <section className="space-y-8">
      <div className="space-y-3">
        <h1 className="text-3xl font-bold tracking-tight text-primary">
          AuditLens AI
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          面向审计与税务场景的智能风险分析系统。上传财务数据，自动识别风险并生成审计报告。
        </p>
      </div>
      <div className="flex flex-wrap gap-4">
        <Link
          href="/upload"
          className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          开始分析
        </Link>
        <Link
          href="/dashboard"
          className="inline-flex h-10 items-center rounded-md border border-border bg-card px-4 text-sm font-medium transition-colors hover:bg-muted"
        >
          查看仪表盘
        </Link>
      </div>
    </section>
  );
}
