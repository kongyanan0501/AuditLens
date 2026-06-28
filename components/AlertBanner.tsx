import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type AlertVariant = "error" | "warning" | "info";

type AlertBannerProps = {
  icon: LucideIcon;
  title: string;
  description?: string;
  variant?: AlertVariant;
  className?: string;
};

const variantStyles: Record<AlertVariant, string> = {
  error: "border-destructive/30 bg-destructive/5 text-destructive",
  warning: "border-warning/30 bg-warning/10 text-warning",
  info: "border-primary/30 bg-primary/5 text-primary",
};

export function AlertBanner({
  icon: Icon,
  title,
  description,
  variant = "info",
  className,
}: AlertBannerProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex gap-3 rounded-lg border px-4 py-3 text-sm",
        variantStyles[variant],
        className,
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0">
        <p className="font-medium">{title}</p>
        {description ? (
          <p className="mt-1 text-xs leading-relaxed opacity-90">{description}</p>
        ) : null}
      </div>
    </div>
  );
}
