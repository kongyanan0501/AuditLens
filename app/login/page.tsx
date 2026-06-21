import { Suspense } from "react";
import { ShieldCheck } from "lucide-react";
import { LoginForm } from "@/components/LoginForm";
import { Panel } from "@/components/ui/panel";

export default function LoginPage() {
  return (
    <div className="grid min-h-[100dvh] lg:grid-cols-2">
      <div className="al-hero-panel relative hidden flex-col justify-between p-10 text-primary-foreground lg:flex">
        <div className="relative z-10">
          <p className="text-lg font-semibold tracking-tight">AuditLens AI</p>
          <p className="mt-1 text-sm text-primary-foreground/70">
            智能审计风险分析
          </p>
        </div>

        <div className="relative z-10 space-y-6">
          <h1 className="max-w-md text-3xl font-semibold leading-tight tracking-tight md:text-4xl">
            上传财务数据，自动识别审计风险
          </h1>
          <p className="max-w-sm text-sm leading-relaxed text-primary-foreground/75">
            规则引擎与异常检测并行运行，为审计与税务场景提供可解释的风险评分与问题清单。
          </p>
          <ul className="space-y-3 text-sm text-primary-foreground/85">
            <li className="flex items-center gap-2.5">
              <span className="flex size-7 items-center justify-center rounded-md bg-white/10">
                <ShieldCheck className="size-4 shrink-0" aria-hidden />
              </span>
              重复发票与审批缺失检测
            </li>
            <li className="flex items-center gap-2.5">
              <span className="flex size-7 items-center justify-center rounded-md bg-white/10">
                <ShieldCheck className="size-4 shrink-0" aria-hidden />
              </span>
              金额异常与供应商集中度分析
            </li>
            <li className="flex items-center gap-2.5">
              <span className="flex size-7 items-center justify-center rounded-md bg-white/10">
                <ShieldCheck className="size-4 shrink-0" aria-hidden />
              </span>
              结构化审计报告一键生成
            </li>
          </ul>
        </div>

        <p className="relative z-10 text-xs text-primary-foreground/45">
          面向审计与税务场景的专业工具
        </p>
      </div>

      <div className="al-canvas flex flex-col justify-center px-6 py-12 sm:px-12">
        <div className="relative z-10 mx-auto w-full max-w-md space-y-8">
          <div className="space-y-2 lg:hidden">
            <p className="al-brand-mark text-sm">AuditLens AI</p>
            <h1 className="text-2xl font-semibold tracking-tight">登录</h1>
          </div>

          <div className="hidden space-y-2 lg:block">
            <h1 className="text-2xl font-semibold tracking-tight">登录</h1>
            <p className="text-sm text-muted-foreground">
              使用邮箱和密码进入审计仪表盘
            </p>
          </div>

          <Panel className="p-6">
            <Suspense
              fallback={
                <div className="space-y-4">
                  <div className="h-10 animate-pulse rounded-md bg-muted" />
                  <div className="h-10 animate-pulse rounded-md bg-muted" />
                  <div className="h-10 animate-pulse rounded-md bg-muted" />
                </div>
              }
            >
              <LoginForm />
            </Suspense>
          </Panel>
        </div>
      </div>
    </div>
  );
}
