"use client";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

function formatDate(iso: string | undefined) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export function ProfileCard() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <p className="text-sm text-muted-foreground">加载中...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <p className="text-sm text-muted-foreground">未登录，请先登录。</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <dl className="space-y-4">
          <div>
            <dt className="text-sm font-medium text-muted-foreground">邮箱</dt>
            <dd className="mt-1 text-base">{user.email ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-muted-foreground">用户 ID</dt>
            <dd className="mt-1 break-all font-mono text-sm text-foreground/80">
              {user.id}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-muted-foreground">注册时间</dt>
            <dd className="mt-1 text-base">{formatDate(user.created_at)}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-muted-foreground">上次登录</dt>
            <dd className="mt-1 text-base">{formatDate(user.last_sign_in_at)}</dd>
          </div>
        </dl>
      </div>

      <form action="/auth/signout" method="post">
        <Button type="submit" variant="outline" className="w-full sm:w-auto">
          退出登录
        </Button>
      </form>
    </div>
  );
}
