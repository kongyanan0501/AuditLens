"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    const { error: signInError } = await signIn(email.trim(), password);

    if (signInError) {
      const message = signInError.message.toLowerCase();
      if (
        message.includes("fetch") ||
        message.includes("network") ||
        message.includes("failed to fetch")
      ) {
        setError(
          "无法连接 Supabase。请检查 .env.local 中的 NEXT_PUBLIC_SUPABASE_URL 是否有效（项目是否已暂停/删除），以及本机网络。",
        );
      } else if (
        message.includes("invalid login") ||
        message.includes("invalid credentials")
      ) {
        setError("登录失败，请检查邮箱和密码。");
      } else {
        setError(`登录失败：${signInError.message}`);
      }
      setSubmitting(false);
      return;
    }

    // 硬跳转确保 Auth Cookie 写入后再进受保护路由，避免中间件读到空会话
    const redirectTo = searchParams.get("redirectTo") ?? "/dashboard";
    const safePath =
      redirectTo.startsWith("/") && !redirectTo.startsWith("//")
        ? redirectTo
        : "/dashboard";
    window.location.assign(safePath);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="email" className="text-sm font-medium">
          邮箱
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          placeholder="name@company.com"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="password" className="text-sm font-medium">
          密码
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          placeholder="请输入密码"
        />
      </div>

      {error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? "登录中..." : "登录"}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        首次使用请在 Supabase Dashboard 创建测试账号。
      </p>
    </form>
  );
}
