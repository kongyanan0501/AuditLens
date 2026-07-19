import type { AuditRecord, EvidenceRow } from "@/types/audit";

export function collectRecordIndices(item: {
  recordIndex?: number;
  metadata?: Record<string, unknown>;
}): number[] {
  const indices = new Set<number>();

  if (typeof item.recordIndex === "number") {
    indices.add(item.recordIndex);
  }

  const meta = item.metadata ?? {};
  if (typeof meta.recordIndex === "number") {
    indices.add(meta.recordIndex);
  }

  if (Array.isArray(meta.recordIndices)) {
    for (const value of meta.recordIndices) {
      if (typeof value === "number") {
        indices.add(value);
      }
    }
  }

  return [...indices].sort((a, b) => a - b);
}

function toEvidenceRow(record: AuditRecord): EvidenceRow {
  return {
    date: record.date,
    type: record.type,
    amount: record.amount,
    vendor: record.vendor,
    invoiceId: record.invoiceId,
    ...(record.department ? { department: record.department } : {}),
    ...(record.region ? { region: record.region } : {}),
    ...(record.approvedBy ? { approvedBy: record.approvedBy } : {}),
  };
}

export function buildEvidenceSnapshot(
  records: AuditRecord[],
  item: { recordIndex?: number; metadata?: Record<string, unknown> },
): EvidenceRow[] {
  return collectRecordIndices(item).flatMap((index) => {
    const record = records[index];
    return record ? [toEvidenceRow(record)] : [];
  });
}

export function withEvidenceMetadata(
  records: AuditRecord[],
  item: { recordIndex?: number; metadata?: Record<string, unknown> },
): Record<string, unknown> {
  const evidence = buildEvidenceSnapshot(records, item);
  return {
    ...item.metadata,
    ...(evidence.length > 0 ? { evidence } : {}),
  };
}
