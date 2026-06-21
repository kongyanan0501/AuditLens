"use client";

import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";

type ThemeToggleProps = {
  className?: string;
  showLabel?: boolean;
};

export function ThemeToggle({ className, showLabel = false }: ThemeToggleProps) {
  const { theme, toggleTheme, mounted } = useTheme();
  const isDark = theme === "dark";

  return (
    <Button
      type="button"
      variant="ghost"
      size={showLabel ? "sm" : "icon-sm"}
      onClick={toggleTheme}
      aria-label={isDark ? "切换为浅色模式" : "切换为深色模式"}
      className={cn(
        "text-muted-foreground hover:text-foreground",
        showLabel && "gap-2 px-3",
        className,
      )}
    >
      {!mounted ? (
        <span className="size-4" aria-hidden />
      ) : isDark ? (
        <Sun className="size-4" aria-hidden />
      ) : (
        <Moon className="size-4" aria-hidden />
      )}
      {showLabel && mounted ? (
        <span className="text-xs">{isDark ? "浅色" : "深色"}</span>
      ) : null}
    </Button>
  );
}
