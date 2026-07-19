import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildEvidenceSnapshot,
  collectRecordIndices,
} from "@/server/evidence";
import type { AuditRecord } from "@/types/audit";

const records: AuditRecord[] = [
  {
    date: "2025-03-13",
    type: "expense",
    amount: 6000,
    vendor: "华信",
    invoiceId: "INV-0088",
    approvedBy: "王强",
  },
  {
    date: "2025-03-14",
    type: "expense",
    amount: 6200,
    vendor: "华信",
    invoiceId: "INV-0088",
    approvedBy: "王强",
  },
];

describe("collectRecordIndices", () => {
  it("reads recordIndices from metadata", () => {
    assert.deepEqual(
      collectRecordIndices({ metadata: { recordIndices: [0, 1] } }),
      [0, 1],
    );
  });

  it("reads recordIndex from metadata or top-level", () => {
    assert.deepEqual(
      collectRecordIndices({ metadata: { recordIndex: 1 } }),
      [1],
    );
    assert.deepEqual(collectRecordIndices({ recordIndex: 0 }), [0]);
  });
});

describe("buildEvidenceSnapshot", () => {
  it("maps related records to evidence rows", () => {
    const evidence = buildEvidenceSnapshot(records, {
      metadata: { recordIndices: [0, 1] },
    });
    assert.equal(evidence.length, 2);
    assert.equal(evidence[0]?.invoiceId, "INV-0088");
    assert.equal(evidence[1]?.amount, 6200);
  });

  it("returns empty array when no indices", () => {
    assert.deepEqual(buildEvidenceSnapshot(records, {}), []);
  });
});
