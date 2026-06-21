import Link from "next/link";
import { ArrowRight, BarChart3, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";

export default function HomePage() {
  return (
    <section className="space-y-10">
      <div className="max-w-2xl space-y-3">
        <h1 className="al-brand-mark al-display">AuditLens AI</h1>
        <p className="text-base leading-relaxed text-muted-foreground">
          面向审计与税务场景的智能风险分析系统。上传财务数据，自动识别风险并生成审计报告。
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        <Panel
          interactive
          glow
          className="p-6 md:col-span-3"
        >
          <div className="flex size-10 items-center justify-center rounded-lg bg-[var(--primary-muted)] text-primary">
            <FileSpreadsheet className="size-5" aria-hidden />
          </div>
          <h2 className="mt-4 text-lg font-semibold tracking-tight">上传分析</h2>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
            导入 Excel / CSV 财务数据，触发 LangGraph 六节点审计流水线，秒级输出风险评分与问题清单。
          </p>
          <Button asChild className="mt-6 shadow-[var(--shadow-glow)] active:scale-[0.98]">
            <Link href="/upload">
              开始分析
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </Panel>

        <Panel interactive className="p-6 md:col-span-2">
          <div className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <BarChart3 className="size-5" aria-hidden />
          </div>
          <h2 className="mt-4 font-semibold tracking-tight">审计仪表盘</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            查看风险评分、问题分布与历史任务概览。
          </p>
          <Button
            asChild
            variant="outline"
            className="mt-6 active:scale-[0.98]"
          >
            <Link href="/dashboard">
              进入仪表盘
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </Panel>
      </div>
    </section>
  );
}
