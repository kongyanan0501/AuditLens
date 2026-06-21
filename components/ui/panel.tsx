import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type PanelProps = {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
  glow?: boolean;
};

export function Panel({
  children,
  className,
  interactive = false,
  glow = false,
}: PanelProps) {
  return (
    <div
      className={cn(
        "al-panel",
        interactive && "al-panel-interactive",
        glow && "al-panel-glow",
        className,
      )}
    >
      {children}
    </div>
  );
}

type PanelHeaderProps = {
  title: string;
  description?: string;
  className?: string;
};

export function PanelHeader({ title, description, className }: PanelHeaderProps) {
  return (
    <div className={cn("border-b border-[var(--border-subtle)] px-5 py-4", className)}>
      <h2 className="font-semibold tracking-tight text-foreground">{title}</h2>
      {description ? (
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}
