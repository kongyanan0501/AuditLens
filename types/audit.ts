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

/** Rule or anomaly finding before persistence */
export type AuditIssue = {
  id?: string;
  taskId?: string;
  type: IssueType;
  severity: IssueSeverity;
  reason: string;
  metadata?: Record<string, unknown>;
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
