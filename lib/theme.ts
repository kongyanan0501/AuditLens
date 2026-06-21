/**
 * AuditLens theme constants for programmatic use (charts, canvas, PDF export).
 * Visual tokens live in styles/auditlens-theme.css.
 */

export const brand = {
  name: "AuditLens AI",
  primary: "#1E3A8A",
  primaryDark: "#4D7CFF",
} as const;

export const radius = {
  sm: "calc(var(--radius) - 4px)",
  md: "calc(var(--radius) - 2px)",
  lg: "var(--radius)",
  xl: "calc(var(--radius) + 4px)",
} as const;

export const chartColors = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
] as const;

export type RiskTier = "safe" | "watch" | "alert" | "critical" | "unknown";

const riskTiers = {
  safe: { min: 80, label: "安全", token: "success" },
  watch: { min: 60, label: "关注", token: "warning" },
  alert: { min: 40, label: "预警", token: "warning" },
  critical: { min: 0, label: "高危", token: "destructive" },
  unknown: { min: -1, label: "暂无", token: "muted" },
} as const;

export function getRiskTier(score: number | null): RiskTier {
  if (score === null) return "unknown";
  if (score >= 80) return "safe";
  if (score >= 60) return "watch";
  if (score >= 40) return "alert";
  return "critical";
}

export function getRiskLabel(score: number | null): string {
  return riskTiers[getRiskTier(score)].label;
}

export const issueTypeChartColor: Record<string, string> = {
  duplicate: "var(--chart-1)",
  anomaly: "var(--chart-3)",
  approval: "var(--destructive)",
  vendor_concentration: "var(--chart-2)",
};

export const themeModes = ["dark", "light"] as const;
export type ThemeMode = (typeof themeModes)[number];

export const defaultThemeMode: ThemeMode = "dark";
export const themeStorageKey = "auditlens-theme";

export function isThemeMode(value: string | null): value is ThemeMode {
  return value === "dark" || value === "light";
}

export function applyThemeMode(mode: ThemeMode) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(mode);
  root.setAttribute("data-theme", mode);
}

export function readStoredThemeMode(): ThemeMode | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(themeStorageKey);
    return isThemeMode(stored) ? stored : null;
  } catch {
    return null;
  }
}

export function persistThemeMode(mode: ThemeMode) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(themeStorageKey, mode);
  } catch {
    // ignore quota / private mode
  }
}
