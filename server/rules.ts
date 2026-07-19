import { ruleHitMeta } from "@/server/rule-config";
import type {
  AuditIssue,
  AuditRecord,
  RuleThresholdConfig,
} from "@/types/audit";
import {
  DEFAULT_RULE_SCOPE,
  DEFAULT_RULE_THRESHOLDS,
  RULE_IDS,
} from "@/types/audit";

function isBlank(value: string | undefined): boolean {
  return value === undefined || value.trim() === "";
}

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

/** invoiceId 重复：同一 ID 出现多于一次 */
export function detectDuplicates(
  records: AuditRecord[],
  config?: Partial<RuleThresholdConfig>,
): AuditIssue[] {
  const resolved = resolveConfig(config);
  const byInvoiceId = new Map<string, number[]>();

  records.forEach((record, index) => {
    const invoiceId = record.invoiceId.trim();
    if (invoiceId === "") return;

    const indices = byInvoiceId.get(invoiceId) ?? [];
    indices.push(index);
    byInvoiceId.set(invoiceId, indices);
  });

  const issues: AuditIssue[] = [];

  for (const [invoiceId, indices] of byInvoiceId) {
    if (indices.length <= 1) continue;

    issues.push({
      type: "duplicate",
      severity: "high",
      reason: `发票号 ${invoiceId} 重复出现 ${indices.length} 次`,
      metadata: {
        invoiceId,
        recordIndices: indices,
        ...ruleHitMeta(RULE_IDS.duplicate, resolved, {
          minOccurrences: 2,
          observedOccurrences: indices.length,
        }),
      },
    });
  }

  return issues;
}

/** 支出记录达到必审金额且缺少审批人 */
export function detectMissingApproval(
  records: AuditRecord[],
  config?: Partial<RuleThresholdConfig>,
): AuditIssue[] {
  const resolved = resolveConfig(config);
  const minAmount = resolved.approvalRequiredMinAmount;
  const issues: AuditIssue[] = [];

  records.forEach((record, index) => {
    if (record.type !== "expense") return;
    if (record.amount < minAmount) return;
    if (!isBlank(record.approvedBy)) return;

    issues.push({
      type: "approval",
      severity: "medium",
      reason:
        minAmount > 0
          ? `支出记录（发票 ${record.invoiceId || "无"}）金额 ${record.amount} ≥ 必审门槛 ${minAmount}，缺少审批人`
          : `支出记录（发票 ${record.invoiceId || "无"}）缺少审批人`,
      metadata: {
        recordIndex: index,
        invoiceId: record.invoiceId,
        amount: record.amount,
        ...ruleHitMeta(RULE_IDS.approval, resolved, {
          approvalRequiredMinAmount: minAmount,
        }),
      },
    });
  });

  return issues;
}

/** RuleCheck 节点：合并重复与审批缺失 */
export function runRuleCheck(
  records: AuditRecord[],
  config?: Partial<RuleThresholdConfig>,
): AuditIssue[] {
  return [
    ...detectDuplicates(records, config),
    ...detectMissingApproval(records, config),
  ];
}
