import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  AMOUNT_ANOMALY_MULTIPLIER,
  detectAmountAnomalies,
  detectVendorConcentration,
  runAnomalyDetection,
} from "@/server/anomaly";
import {
  computeRiskScore,
  runDeterministicAudit,
} from "@/server/audit-engine";
import {
  detectDuplicates,
  detectMissingApproval,
  runRuleCheck,
} from "@/server/rules";
import type { AuditRecord } from "@/types/audit";

const sampleRecords: AuditRecord[] = [
  {
    date: "2025-01-10",
    type: "expense",
    amount: 100,
    vendor: "VendorA",
    invoiceId: "INV-001",
    approvedBy: "Alice",
  },
  {
    date: "2025-01-11",
    type: "expense",
    amount: 100,
    vendor: "VendorA",
    invoiceId: "INV-002",
    approvedBy: "Alice",
  },
  {
    date: "2025-01-12",
    type: "expense",
    amount: 100,
    vendor: "VendorB",
    invoiceId: "INV-001",
    approvedBy: "Bob",
  },
  {
    date: "2025-01-13",
    type: "expense",
    amount: 100,
    vendor: "VendorA",
    invoiceId: "INV-003",
    approvedBy: "Alice",
  },
  {
    date: "2025-01-14",
    type: "expense",
    amount: 100,
    vendor: "VendorA",
    invoiceId: "INV-004",
    approvedBy: "Alice",
  },
  {
    date: "2025-01-15",
    type: "expense",
    amount: 100,
    vendor: "VendorA",
    invoiceId: "INV-005",
    approvedBy: "Alice",
  },
  {
    date: "2025-01-16",
    type: "expense",
    amount: 100,
    vendor: "VendorA",
    invoiceId: "INV-006",
  },
];

describe("rules", () => {
  it("detects duplicate invoiceId", () => {
    const issues = detectDuplicates(sampleRecords);
    assert.equal(issues.length, 1);
    assert.equal(issues[0]?.type, "duplicate");
    assert.equal(issues[0]?.severity, "high");
    assert.deepEqual(issues[0]?.metadata?.recordIndices, [0, 2]);
  });

  it("detects missing approval on expense records", () => {
    const issues = detectMissingApproval(sampleRecords);
    assert.equal(issues.length, 1);
    assert.equal(issues[0]?.type, "approval");
    assert.equal(issues[0]?.metadata?.recordIndex, 6);
  });

  it("runRuleCheck merges duplicate and approval issues", () => {
    const issues = runRuleCheck(sampleRecords);
    assert.equal(issues.length, 2);
  });
});

describe("anomaly", () => {
  it("flags amount above avg × multiplier", () => {
    const amountFixture: AuditRecord[] = [
      ...Array.from({ length: 13 }, (_, index) => ({
        date: "2025-01-01",
        type: "expense" as const,
        amount: 100,
        vendor: `V${index}`,
        invoiceId: `AMT-${index}`,
        approvedBy: "Mgr",
      })),
      {
        date: "2025-01-14",
        type: "expense",
        amount: 730,
        vendor: "BigVendor",
        invoiceId: "AMT-OUT",
        approvedBy: "Mgr",
      },
    ];

    const avg =
      amountFixture.reduce((sum, record) => sum + record.amount, 0) /
      amountFixture.length;
    const anomalies = detectAmountAnomalies(amountFixture);
    const flagged = anomalies.filter((a) => a.recordIndex === 13);

    assert.equal(flagged.length, 1);
    assert.equal(flagged[0]?.type, "anomaly");
    assert.ok(730 > avg * AMOUNT_ANOMALY_MULTIPLIER);
  });

  it("detects vendor concentration on expenses", () => {
    const anomalies = detectVendorConcentration(sampleRecords);
    const vendorA = anomalies.find(
      (a) => a.metadata?.vendor === "VendorA",
    );

    assert.ok(vendorA);
    assert.equal(vendorA.type, "vendor_concentration");
  });

  it("runAnomalyDetection returns vendor concentration findings", () => {
    const anomalies = runAnomalyDetection(sampleRecords);
    assert.ok(anomalies.some((a) => a.type === "vendor_concentration"));
  });
});

describe("audit-engine", () => {
  it("computeRiskScore applies MVP weights", () => {
    const score = computeRiskScore({
      issues: [
        { type: "duplicate", severity: "high", reason: "dup" },
        { type: "approval", severity: "medium", reason: "missing" },
      ],
      anomalies: [
        { type: "anomaly", severity: "high", reason: "amount" },
        { type: "vendor_concentration", severity: "medium", reason: "vendor" },
      ],
    });

    // 100 - 10 - 8 - (2 × 5) = 72
    assert.equal(score, 72);
  });

  it("clamps score to [0, 100]", () => {
    const low = computeRiskScore({
      issues: Array.from({ length: 20 }, () => ({
        type: "duplicate" as const,
        severity: "high" as const,
        reason: "dup",
      })),
      anomalies: [],
    });
    assert.equal(low, 0);
  });

  it("runDeterministicAudit produces issues, anomalies, and score", () => {
    const result = runDeterministicAudit(sampleRecords);

    assert.ok(result.issues.length >= 2);
    assert.ok(result.anomalies.length >= 1);
    assert.ok(result.score >= 0 && result.score <= 100);
    assert.ok(result.score < 100);
  });

  it("returns perfect score for clean records", () => {
    const clean: AuditRecord[] = [
      {
        date: "2025-02-01",
        type: "expense",
        amount: 100,
        vendor: "V1",
        invoiceId: "A-1",
        approvedBy: "Mgr",
      },
      {
        date: "2025-02-02",
        type: "expense",
        amount: 100,
        vendor: "V2",
        invoiceId: "A-2",
        approvedBy: "Mgr",
      },
      {
        date: "2025-02-03",
        type: "expense",
        amount: 100,
        vendor: "V3",
        invoiceId: "A-3",
        approvedBy: "Mgr",
      },
    ];

    const result = runDeterministicAudit(clean);
    assert.equal(result.issues.length, 0);
    assert.equal(result.anomalies.length, 0);
    assert.equal(result.score, 100);
  });
});
