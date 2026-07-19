"use client";

import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { useAuth } from "@/hooks/useAuth";

function formatDate(iso: string | undefined) {
  if (!iso) return "暂无";
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function ProfileSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3, 4].map((row) => (
        <div key={row} className="space-y-2">
          <div className="h-4 w-16 animate-pulse rounded bg-muted" />
          <div className="h-5 w-full max-w-xs animate-pulse rounded bg-muted/70" />
        </div>
      ))}
    </div>
  );
}

export function ProfileCard() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <Panel className="p-6">
        <ProfileSkeleton />
      </Panel>
    );
  }

  if (!user) {
    return (
      <Panel className="p-6">
        <p className="text-sm text-muted-foreground">未登录，请先登录。</p>
      </Panel>
    );
  }

  return (
    <div className="space-y-6">
      <Panel className="p-6">
        <dl className="grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <dt className="al-label">邮箱</dt>
            <dd className="mt-1 break-all text-base">
              {user.email ?? "暂无"}
            </dd>
            <p className="mt-1 text-xs text-muted-foreground">
              审计分派整改时填写此邮箱
            </p>
          </div>
          <div>
            <dt className="al-label">注册时间</dt>
            <dd className="mt-1 text-base">{formatDate(user.created_at)}</dd>
          </div>
          <div>
            <dt className="al-label">上次登录</dt>
            <dd className="mt-1 text-base">{formatDate(user.last_sign_in_at)}</dd>
          </div>
        </dl>
      </Panel>

      <form action="/auth/signout" method="post">
        <Button
          type="submit"
          variant="outline"
          className="w-full active:scale-[0.98] sm:w-auto"
        >
          退出登录
        </Button>
      </form>
    </div>
  );
}
