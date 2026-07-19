"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Panel, PanelHeader } from "@/components/ui/panel";
import type { UserRole } from "@/types/audit";

const ROLE_LABELS: Record<UserRole, string> = {
  auditor: "审计（看全量、可分派）",
  business: "业务（仅看分派给自己的项）",
};

type RoleSwitcherProps = {
  /** Demo-only self switch; requires ALLOW_DEMO_ROLE_SWITCH=true on server */
  allowDemoSwitch?: boolean;
};

export function RoleSwitcher({ allowDemoSwitch = false }: RoleSwitcherProps) {
  const [role, setRole] = useState<UserRole | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const response = await fetch("/api/profile");
      const json = (await response.json()) as {
        data?: { role: UserRole };
        error?: string;
      };
      if (!response.ok || !json.data) {
        setError(json.error ?? "加载角色失败");
        return;
      }
      setRole(json.data.role);
    });
  }, []);

  const switchRole = (next: UserRole) => {
    setError(null);
    startTransition(async () => {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: next }),
      });
      const json = (await response.json()) as {
        data?: { role: UserRole };
        error?: string;
      };
      if (!response.ok || !json.data) {
        setError(json.error ?? "更新角色失败");
        return;
      }
      setRole(json.data.role);
      window.location.reload();
    });
  };

  return (
    <Panel className="overflow-hidden">
      <PanelHeader
        title="角色权限"
        description={
          allowDemoSwitch
            ? "演示环境可自行切换；生产请关闭 ALLOW_DEMO_ROLE_SWITCH"
            : "角色由管理员在数据库 profiles 表指定"
        }
      />
      <div className="space-y-3 px-5 py-4">
        <p className="text-sm">
          当前角色：
          <span className="ml-1 font-medium">
            {role ? ROLE_LABELS[role] : "加载中…"}
          </span>
        </p>
        {allowDemoSwitch ? (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={role === "auditor" ? "default" : "outline"}
              disabled={pending || role === "auditor"}
              onClick={() => switchRole("auditor")}
            >
              切换为审计
            </Button>
            <Button
              type="button"
              size="sm"
              variant={role === "business" ? "default" : "outline"}
              disabled={pending || role === "business"}
              onClick={() => switchRole("business")}
            >
              切换为业务
            </Button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            演示切换未开启。本地可在 `.env.local` 设置{" "}
            <code className="text-[11px]">ALLOW_DEMO_ROLE_SWITCH=true</code>。
          </p>
        )}
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </div>
    </Panel>
  );
}
