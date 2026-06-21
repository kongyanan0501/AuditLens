type RiskScoreCardProps = {
  score: number | null;
  label?: string;
  variant?: "default" | "warning" | "danger";
};

const variantStyles = {
  default: "border-border",
  warning: "border-warning/40 bg-warning/5",
  danger: "border-destructive/40 bg-destructive/5",
};

export function RiskScoreCard({
  score,
  label = "风险评分",
  variant = "default",
}: RiskScoreCardProps) {
  return (
    <div
      className={`rounded-lg border bg-card p-6 shadow-sm ${variantStyles[variant]}`}
    >
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="mt-2 text-3xl font-bold text-primary">
        {score === null ? "—" : score}
      </p>
    </div>
  );
}
