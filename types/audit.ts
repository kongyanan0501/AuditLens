/**
 * Domain types for AuditLens audit pipeline.
 * Spec reference: docs/init.md §8.2–8.6
 */

/** Parsed financial row from Excel/CSV (spec name: Record) */
export type AuditRecord = {
  date: string;
  type: "income" | "expense";
  amount: number;
  vendor: string;
  invoiceId: string;
  category?: string;
  department?: string;
  region?: string;
  approvedBy?: string;
};

export type TaskStatus = "pending" | "running" | "completed" | "failed";

export type IssueType =
  | "duplicate"
  | "anomaly"
  | "approval"
  | "vendor_concentration";

export type IssueSeverity = "low" | "medium" | "high";

/** Issue remediation workflow (Phase 11+) */
export type IssueWorkflowStatus =
  | "pending_review"
  | "confirmed"
  | "false_positive"
  | "remediating"
  | "pending_verification"
  | "closed";

export type UserRole = "auditor" | "business";

/** Remediation proof file kind */
export type IssueAttachmentKind = "evidence" | "corrected_file";

/** Snapshot of a related ledger row stored on issue metadata for evidence UI */
export type EvidenceRow = {
  date: string;
  type: "income" | "expense";
  amount: number;
  vendor: string;
  invoiceId: string;
  department?: string;
  region?: string;
  approvedBy?: string;
};

/** Runtime rule thresholds used by RuleCheck / AnomalyDetection */
export type RuleThresholdConfig = {
  amountAnomalyMultiplier: number;
  vendorConcentrationThreshold: number;
  /** Expense amount ≥ this value requires approval; 0 = all expenses */
  approvalRequiredMinAmount: number;
  version: number;
  scopeKey: string;
};

export const DEFAULT_RULE_SCOPE = "default";

export const DEFAULT_RULE_THRESHOLDS = {
  amountAnomalyMultiplier: 5,
  vendorConcentrationThreshold: 0.5,
  approvalRequiredMinAmount: 0,
} as const;

export const RULE_IDS = {
  duplicate: "R-DUP-001",
  approval: "R-APR-001",
  anomaly: "R-ANM-001",
  vendorConcentration: "R-VEN-001",
} as const;

export const ISSUE_WORKFLOW_STATUSES: IssueWorkflowStatus[] = [
  "pending_review",
  "confirmed",
  "false_positive",
  "remediating",
  "pending_verification",
  "closed",
];

export const ISSUE_ATTACHMENT_KINDS: IssueAttachmentKind[] = [
  "evidence",
  "corrected_file",
];

/** Rule or anomaly finding before persistence */
export type AuditIssue = {
  id?: string;
  taskId?: string;
  type: IssueType;
  severity: IssueSeverity;
  reason: string;
  metadata?: Record<string, unknown>;
  workflowStatus?: IssueWorkflowStatus;
  assigneeId?: string | null;
  resolutionNote?: string | null;
  statusUpdatedAt?: string | null;
  statusUpdatedBy?: string | null;
  remediationAction?: string | null;
  remediationResult?: string | null;
  remediationSubmittedAt?: string | null;
  remediationSubmittedBy?: string | null;
};

export type IssueAttachment = {
  id: string;
  issueId: string;
  uploadedBy: string;
  kind: IssueAttachmentKind;
  fileName: string;
  mimeType: string;
  byteSize: number;
  storagePath: string;
  createdAt: string;
  signedUrl?: string;
};

export type IssueWorkflowEvent = {
  id: string;
  issueId: string;
  actorId: string | null;
  fromStatus: string | null;
  toStatus: string;
  note: string | null;
  createdAt: string;
};

/** Statistical anomaly (pre-issue aggregation) */
export type AuditAnomaly = {
  type: IssueType;
  severity: IssueSeverity;
  reason: string;
  recordIndex?: number;
  metadata?: Record<string, unknown>;
};

/** LLM explanation attached to a risk item */
export type IssueExplanation = {
  issueId?: string;
  summary: string;
  ruleReference?: string;
  recommendation: string;
};

/** Persisted audit task */
export type AuditTask = {
  id: string;
  userId: string;
  fileName: string;
  status: TaskStatus;
  score: number | null;
  /** Rule config version used when the task ran */
  ruleConfigVersion?: number | null;
  createdAt: string;
  updatedAt?: string;
};

/** Persisted audit report */
export type AuditReport = {
  id: string;
  taskId: string;
  content: string;
  createdAt: string;
};

/** RAG knowledge base entry */
export type KnowledgeEntry = {
  id: string;
  content: string;
  category: string | null;
  policyName?: string | null;
  clauseId?: string | null;
  createdAt: string;
};

/** Vector upsert payload for Pinecone / VectorStore */
export type VectorRecord = {
  id: string;
  values: number[];
  metadata?: Record<string, unknown>;
};

/** Vector similarity search hit */
export type SearchResult = {
  id: string;
  score: number;
  metadata?: Record<string, unknown>;
};

/** LangGraph state passed between pipeline nodes */
export type AuditGraphState = {
  taskId?: string;
  userId?: string;
  fileName?: string;
  /** Transient upload bytes for ParseExcel (not persisted) */
  fileContent?: Uint8Array;
  /** Active rule thresholds for this run (from audit_rule_configs) */
  ruleConfig?: RuleThresholdConfig;
  records: AuditRecord[];
  issues: AuditIssue[];
  anomalies: AuditAnomaly[];
  score?: number;
  explanations: IssueExplanation[];
  report?: string;
  status: TaskStatus;
  error?: string;
};

export const TASK_STATUSES: TaskStatus[] = [
  "pending",
  "running",
  "completed",
  "failed",
];

export const ISSUE_SEVERITIES: IssueSeverity[] = ["low", "medium", "high"];

/** MVP risk scoring weights (docs/init.md §8.4) */
export const RISK_SCORE_WEIGHTS = {
  duplicate: 10,
  anomaly: 5,
  missingApproval: 8,
} as const;

export function createInitialGraphState(
  overrides: Partial<AuditGraphState> = {},
): AuditGraphState {
  return {
    records: [],
    issues: [],
    anomalies: [],
    explanations: [],
    status: "pending",
    ...overrides,
  };
}
