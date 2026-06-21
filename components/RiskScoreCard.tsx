import { cn } from "@/lib/utils";
import { getRiskTier } from "@/lib/theme";

type RiskVariant = "default" | "warning" | "danger" | "success";

type RiskScoreCardProps = {
  score: number | null;
  label?: string;
  variant?: RiskVariant;
  description?: string;
  featured?: boolean;
};

const variantStyles = {
  default: "",
  success: "border-success/25 bg-success/[0.06]",
  warning: "border-warning/25 bg-warning/[0.06]",
  danger: "border-destructive/25 bg-destructive/[0.06]",
};

const scoreColorStyles = {
  default: "text-foreground",
  success: "text-success",
  warning: "text-warning",
  danger: "text-destructive",
};

const accentBarStyles = {
  default: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-destructive",
};

function inferVariant(score: number | null, override?: RiskVariant): RiskVariant {
  if (override && override !== "default") return override;
  if (score === null) return "default";
  const tier = getRiskTier(score);
  if (tier === "safe") return "success";
  if (tier === "watch" || tier === "alert") return "warning";
  if (tier === "critical") return "danger";
  return "default";
}

export function RiskScoreCard({
  score,
  label = "风险评分",
  variant = "default",
  description,
  featured = false,
}: RiskScoreCardProps) {
  const resolvedVariant = inferVariant(score, variant);
  const displayScore = score === null ? "暂无" : score;

  return (
    <div
      className={cn(
        "al-panel al-panel-interactive relative overflow-hidden",
        featured && "al-panel-glow md:col-span-2",
        variantStyles[resolvedVariant],
      )}
    >
      <div
        className={cn(
          "absolute inset-x-0 top-0 h-0.5",
          accentBarStyles[resolvedVariant],
        )}
        aria-hidden
      />
      {featured ? (
        <div
          className="pointer-events-none absolute -right-8 -top-8 size-32 rounded-full bg-primary/10 blur-2xl"
          aria-hidden
        />
      ) : null}
      <div className={cn("relative p-5", featured && "md:p-6")}>
        <p className="al-label">{label}</p>
        <div className="mt-3 flex items-end gap-2">
          <p
            className={cn(
              "al-metric font-semibold",
              featured ? "text-4xl md:text-5xl" : "text-3xl",
              score === null
                ? "text-muted-foreground"
                : scoreColorStyles[resolvedVariant],
            )}
          >
            {displayScore}
          </p>
          {score !== null && (
            <span className="al-metric mb-1 text-xs text-muted-foreground">
              / 100
            </span>
          )}
        </div>
        {description && (
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>
    </div>
  );
}
