import type { AuditIssue, AuditRecord } from "@/types/audit";

function isBlank(value: string | undefined): boolean {
  return value === undefined || value.trim() === "";
}

/** invoiceId 重复：同一 ID 出现多于一次 */
export function detectDuplicates(records: AuditRecord[]): AuditIssue[] {
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
      metadata: { invoiceId, recordIndices: indices },
    });
  }

  return issues;
}

/** 支出记录缺少审批人 */
export function detectMissingApproval(records: AuditRecord[]): AuditIssue[] {
  const issues: AuditIssue[] = [];

  records.forEach((record, index) => {
    if (record.type !== "expense") return;
    if (!isBlank(record.approvedBy)) return;

    issues.push({
      type: "approval",
      severity: "medium",
      reason: `支出记录（发票 ${record.invoiceId || "无"}）缺少审批人`,
      metadata: { recordIndex: index, invoiceId: record.invoiceId },
    });
  });

  return issues;
}

/** RuleCheck 节点：合并重复与审批缺失 */
export function runRuleCheck(records: AuditRecord[]): AuditIssue[] {
  return [...detectDuplicates(records), ...detectMissingApproval(records)];
}
