import type { AuditAnomaly, AuditRecord } from "@/types/audit";

/** 单笔金额超过历史均值的倍数阈值（docs/init.md §8.3） */
export const AMOUNT_ANOMALY_MULTIPLIER = 5;

/** 单一供应商支出金额占比阈值 */
export const VENDOR_CONCENTRATION_THRESHOLD = 0.5;

function averageAmount(records: AuditRecord[]): number {
  if (records.length === 0) return 0;
  const total = records.reduce((sum, record) => sum + record.amount, 0);
  return total / records.length;
}

/** amount > avg × 5 */
export function detectAmountAnomalies(
  records: AuditRecord[],
): AuditAnomaly[] {
  const avg = averageAmount(records);
  if (avg <= 0) return [];

  const threshold = avg * AMOUNT_ANOMALY_MULTIPLIER;
  const anomalies: AuditAnomaly[] = [];

  records.forEach((record, index) => {
    if (record.amount <= threshold) return;

    anomalies.push({
      type: "anomaly",
      severity: record.amount >= avg * AMOUNT_ANOMALY_MULTIPLIER * 2 ? "high" : "medium",
      reason: `金额 ${record.amount} 超过均值 ${avg.toFixed(2)} 的 ${AMOUNT_ANOMALY_MULTIPLIER} 倍`,
      recordIndex: index,
      metadata: {
        amount: record.amount,
        average: avg,
        threshold,
        invoiceId: record.invoiceId,
      },
    });
  });

  return anomalies;
}

/** 单一 vendor 支出金额占比超过 50% */
export function detectVendorConcentration(
  records: AuditRecord[],
): AuditAnomaly[] {
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
    if (share <= VENDOR_CONCENTRATION_THRESHOLD) continue;

    anomalies.push({
      type: "vendor_concentration",
      severity: share >= 0.7 ? "high" : "medium",
      reason: `供应商「${vendor}」支出占比 ${(share * 100).toFixed(1)}%，超过 ${VENDOR_CONCENTRATION_THRESHOLD * 100}% 阈值`,
      metadata: { vendor, amount, total, share },
    });
  }

  return anomalies;
}

/** AnomalyDetection 节点：金额异常 + 供应商集中 */
export function runAnomalyDetection(records: AuditRecord[]): AuditAnomaly[] {
  return [
    ...detectAmountAnomalies(records),
    ...detectVendorConcentration(records),
  ];
}
