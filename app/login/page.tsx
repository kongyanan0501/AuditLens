import { Suspense } from "react";
import { LoginForm } from "@/components/LoginForm";

export default function LoginPage() {
  return (
    <section className="mx-auto max-w-md space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-bold text-primary">登录 AuditLens</h1>
        <p className="text-sm text-muted-foreground">
          使用邮箱和密码登录，进入审计仪表盘。
        </p>
      </div>

      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <Suspense fallback={<p className="text-sm text-muted-foreground">加载中...</p>}>
          <LoginForm />
        </Suspense>
      </div>
    </section>
  );
}
