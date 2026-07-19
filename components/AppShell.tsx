"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Settings2,
  Upload,
  User,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { UserRole } from "@/types/audit";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** If set, only these roles see the item; omit = all authenticated */
  roles?: UserRole[];
};

const navItems: NavItem[] = [
  { href: "/dashboard", label: "仪表盘", icon: LayoutDashboard },
  {
    href: "/upload",
    label: "上传分析",
    icon: Upload,
    roles: ["auditor"],
  },
  {
    href: "/settings/rules",
    label: "规则配置",
    icon: Settings2,
    roles: ["auditor"],
  },
  { href: "/me", label: "我的", icon: User },
];

const HIDDEN_SHELL_PATHS = ["/login"];

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function getPageTitle(pathname: string, role: UserRole | null) {
  if (pathname.startsWith("/dashboard")) {
    return role === "business" ? "我的待办" : "审计仪表盘";
  }
  if (pathname.startsWith("/upload")) return "上传分析";
  if (pathname.startsWith("/settings/rules")) return "规则配置";
  if (pathname.startsWith("/me")) return "我的";
  if (pathname.startsWith("/report")) return "审计报告";
  return "AuditLens AI";
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [role, setRole] = useState<UserRole | null>(null);
  const hideShell = HIDDEN_SHELL_PATHS.some((path) => pathname === path);

  useEffect(() => {
    if (hideShell) return;
    let cancelled = false;
    void fetch("/api/profile")
      .then(async (response) => {
        if (!response.ok) return;
        const json = (await response.json()) as {
          data?: { role: UserRole };
        };
        if (!cancelled && json.data?.role) {
          setRole(json.data.role);
        }
      })
      .catch(() => {
        /* ignore — nav falls back to auditor-visible items until role loads */
      });
    return () => {
      cancelled = true;
    };
  }, [hideShell]);

  if (hideShell) {
    return (
      <div className="relative flex min-h-[100dvh] bg-background">
        <div className="absolute right-4 top-4 z-20 md:right-6 md:top-6">
          <ThemeToggle />
        </div>
        {children}
      </div>
    );
  }

  // Default to showing auditor nav until profile loads; hide once role=business
  const visibleNav = navItems.filter(
    (item) => !item.roles || role !== "business" || item.roles.includes(role),
  );
  const pageTitle = getPageTitle(pathname, role);

  return (
    <div className="al-canvas flex min-h-[100dvh] bg-background">
      <aside className="al-glass fixed inset-y-0 left-0 z-30 hidden w-60 flex-col print:hidden md:flex">
        <div className="relative px-5 py-6">
          <Link href="/" className="group block">
            <span className="al-brand-mark text-base">AuditLens AI</span>
            <span className="mt-1 block text-xs text-muted-foreground transition-colors group-hover:text-foreground">
              智能审计风险分析
            </span>
          </Link>
        </div>

        <nav className="relative flex-1 space-y-0.5 px-3">
          {visibleNav.map((item) => {
            const active = isActivePath(pathname, item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors active:scale-[0.99]",
                  active
                    ? "bg-[var(--sidebar-accent)] text-[var(--accent-foreground)]"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )}
              >
                {active ? (
                  <span
                    className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-primary shadow-[0_0_8px_var(--primary)]"
                    aria-hidden
                  />
                ) : null}
                <Icon className="size-4 shrink-0" aria-hidden />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="relative border-t border-[var(--border-subtle)] px-5 py-4">
          <p className="text-xs text-muted-foreground">LangGraph 审计引擎</p>
        </div>
      </aside>

      <div className="relative z-10 flex min-h-[100dvh] flex-1 flex-col md:pl-60">
        <header className="al-glass sticky top-0 z-20 border-b border-[var(--border-subtle)] print:hidden">
          <div className="flex h-14 items-center justify-between gap-4 px-4 md:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <span className="text-sm font-semibold text-primary md:hidden">
                AuditLens
              </span>
              <p className="hidden truncate text-sm font-medium text-foreground md:block">
                {pageTitle}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <ThemeToggle className="hidden md:inline-flex" showLabel />
              <ThemeToggle className="md:hidden" />
              <nav className="flex items-center gap-1 md:hidden">
              {visibleNav.map((item) => {
                const active = isActivePath(pathname, item.href);
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-label={item.label}
                    className={cn(
                      "flex size-9 items-center justify-center rounded-lg transition-colors active:scale-[0.98]",
                      active
                        ? "bg-[var(--sidebar-accent)] text-[var(--accent-foreground)]"
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                    )}
                  >
                    <Icon className="size-4" aria-hidden />
                  </Link>
                );
              })}
              </nav>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 md:px-8 md:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
