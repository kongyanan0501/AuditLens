import { ruleHitMeta } from "@/server/rule-config";
import type {
  AuditAnomaly,
  AuditRecord,
  RuleThresholdConfig,
} from "@/types/audit";
import {
  DEFAULT_RULE_SCOPE,
  DEFAULT_RULE_THRESHOLDS,
  RULE_IDS,
} from "@/types/audit";

/** @deprecated Prefer config.amountAnomalyMultiplier; kept for tests */
export const AMOUNT_ANOMALY_MULTIPLIER =
  DEFAULT_RULE_THRESHOLDS.amountAnomalyMultiplier;

/** @deprecated Prefer config.vendorConcentrationThreshold; kept for tests */
export const VENDOR_CONCENTRATION_THRESHOLD =
  DEFAULT_RULE_THRESHOLDS.vendorConcentrationThreshold;

function resolveConfig(
  config?: Partial<RuleThresholdConfig>,
): RuleThresholdConfig {
  return {
    amountAnomalyMultiplier:
      config?.amountAnomalyMultiplier ??
      DEFAULT_RULE_THRESHOLDS.amountAnomalyMultiplier,
    vendorConcentrationThreshold:
      config?.vendorConcentrationThreshold ??
      DEFAULT_RULE_THRESHOLDS.vendorConcentrationThreshold,
    approvalRequiredMinAmount:
      config?.approvalRequiredMinAmount ??
      DEFAULT_RULE_THRESHOLDS.approvalRequiredMinAmount,
    version: config?.version ?? 1,
    scopeKey: config?.scopeKey ?? DEFAULT_RULE_SCOPE,
  };
}

function averageAmount(records: AuditRecord[]): number {
  if (records.length === 0) return 0;
  const total = records.reduce((sum, record) => sum + record.amount, 0);
  return total / records.length;
}

/** amount > avg × multiplier */
export function detectAmountAnomalies(
  records: AuditRecord[],
  config?: Partial<RuleThresholdConfig>,
): AuditAnomaly[] {
  const resolved = resolveConfig(config);
  const multiplier = resolved.amountAnomalyMultiplier;
  const avg = averageAmount(records);
  if (avg <= 0) return [];

  const threshold = avg * multiplier;
  const anomalies: AuditAnomaly[] = [];

  records.forEach((record, index) => {
    if (record.amount <= threshold) return;

    anomalies.push({
      type: "anomaly",
      severity: record.amount >= avg * multiplier * 2 ? "high" : "medium",
      reason: `金额 ${record.amount} 超过均值 ${avg.toFixed(2)} 的 ${multiplier} 倍`,
      recordIndex: index,
      metadata: {
        amount: record.amount,
        average: avg,
        threshold,
        invoiceId: record.invoiceId,
        ...ruleHitMeta(RULE_IDS.anomaly, resolved, {
          amountAnomalyMultiplier: multiplier,
          average: avg,
          threshold,
        }),
      },
    });
  });

  return anomalies;
}

/** 单一 vendor 支出金额占比超过配置阈值 */
export function detectVendorConcentration(
  records: AuditRecord[],
  config?: Partial<RuleThresholdConfig>,
): AuditAnomaly[] {
  const resolved = resolveConfig(config);
  const shareThreshold = resolved.vendorConcentrationThreshold;
  const expenses = records.filter(
    (record) => record.type === "expense" && record.vendor.trim() !== "",
  );
  if (expenses.length === 0) return [];

  const total = expenses.reduce((sum, record) => sum + record.amount, 0);
  if (total <= 0) return [];

  const byVendor = new Map<string, number>();
  for (const record of expenses) {
    const vendor = record.vendor.trim();
    byVendor.set(vendor, (byVendor.get(vendor) ?? 0) + record.amount);
  }

  const anomalies: AuditAnomaly[] = [];

  for (const [vendor, amount] of byVendor) {
    const share = amount / total;
    if (share <= shareThreshold) continue;

    anomalies.push({
      type: "vendor_concentration",
      severity: share >= Math.min(0.7, shareThreshold + 0.2) ? "high" : "medium",
      reason: `供应商「${vendor}」支出占比 ${(share * 100).toFixed(1)}%，超过 ${shareThreshold * 100}% 阈值`,
      metadata: {
        vendor,
        amount,
        total,
        share,
        ...ruleHitMeta(RULE_IDS.vendorConcentration, resolved, {
          vendorConcentrationThreshold: shareThreshold,
          share,
        }),
      },
    });
  }

  return anomalies;
}

/** AnomalyDetection 节点：金额异常 + 供应商集中 */
export function runAnomalyDetection(
  records: AuditRecord[],
  config?: Partial<RuleThresholdConfig>,
): AuditAnomaly[] {
  return [
    ...detectAmountAnomalies(records, config),
    ...detectVendorConcentration(records, config),
  ];
}
