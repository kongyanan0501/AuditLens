import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { withEvidenceMetadata } from "@/server/evidence";
import type {
  AuditAnomaly,
  AuditGraphState,
  AuditIssue,
  AuditRecord,
} from "@/types/audit";
import type { Database, Json } from "@/types/database";

type DbClient = SupabaseClient<Database>;

function toJsonMetadata(metadata: Record<string, unknown> | undefined): Json {
  return (metadata ?? {}) as Json;
}

function dbErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message: unknown }).message === "string"
  ) {
    const e = error as { message: string; code?: string; details?: string };
    return [e.message, e.code ? `(${e.code})` : null, e.details]
      .filter(Boolean)
      .join(" ");
  }
  return "数据库操作失败";
}

function throwDb(error: unknown, step: string): never {
  throw new Error(`[${step}] ${dbErrorMessage(error)}`);
}

function isUnknownColumnError(error: unknown): boolean {
  const message = dbErrorMessage(error);
  return (
    message.includes("schema cache") ||
    message.includes("Could not find") ||
    message.includes("workflow_status") ||
    message.includes("rule_config_version")
  );
}

/** Archive fields for workpaper compliance (evidence + rule version + AI text) */
function withWorkpaperArchive(
  reason: string,
  metadata: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const meta = metadata ?? {};
  const llmExplained = meta.llmExplained === true;
  return {
    ...meta,
    workpaper: {
      ruleId: typeof meta.ruleId === "string" ? meta.ruleId : null,
      ruleVersion:
        typeof meta.ruleVersion === "number" ? meta.ruleVersion : null,
      scopeKey: typeof meta.scopeKey === "string" ? meta.scopeKey : null,
      thresholds:
        meta.thresholds && typeof meta.thresholds === "object"
          ? meta.thresholds
          : null,
      evidence: Array.isArray(meta.evidence) ? meta.evidence : [],
      originalReason:
        typeof meta.originalReason === "string" ? meta.originalReason : reason,
      aiExplanation: llmExplained ? reason : null,
      ruleReference:
        typeof meta.ruleReference === "string" ? meta.ruleReference : null,
      recommendation:
        typeof meta.recommendation === "string" ? meta.recommendation : null,
      archivedAt: new Date().toISOString(),
    },
  };
}

function anomalyToIssueRow(
  taskId: string,
  anomaly: AuditAnomaly,
  records: AuditRecord[],
  includeWorkflow: boolean,
) {
  const withEvidence = withEvidenceMetadata(records, {
    recordIndex: anomaly.recordIndex,
    metadata: {
      ...anomaly.metadata,
      recordIndex: anomaly.recordIndex,
    },
  });
  const metadata = withWorkpaperArchive(anomaly.reason, withEvidence);

  return {
    task_id: taskId,
    type: anomaly.type,
    severity: anomaly.severity,
    reason: anomaly.reason,
    metadata: toJsonMetadata(metadata),
    ...(includeWorkflow ? { workflow_status: "pending_review" as const } : {}),
  };
}

function issueToRow(
  taskId: string,
  issue: AuditIssue,
  records: AuditRecord[],
  includeWorkflow: boolean,
) {
  const withEvidence = withEvidenceMetadata(records, {
    metadata: issue.metadata,
  });
  const metadata = withWorkpaperArchive(issue.reason, withEvidence);

  return {
    task_id: taskId,
    type: issue.type,
    severity: issue.severity,
    reason: issue.reason,
    metadata: toJsonMetadata(metadata),
    ...(includeWorkflow ? { workflow_status: "pending_review" as const } : {}),
  };
}

function adminClient() {
  return createAdminClient();
}

export async function createAuditTask(
  _supabase: DbClient,
  userId: string,
  fileName: string,
): Promise<string> {
  void _supabase;
  const admin = adminClient();
  const { data, error } = await admin
    .from("audit_tasks")
    .insert({
      user_id: userId,
      file_name: fileName,
      status: "pending",
    })
    .select("id")
    .single();

  if (error) {
    throwDb(error, "创建审计任务");
  }

  return data.id;
}

export async function updateAuditTask(
  _supabase: DbClient,
  taskId: string,
  userId: string,
  patch: {
    status?: AuditGraphState["status"];
    score?: number | null;
    ruleConfigVersion?: number | null;
  },
): Promise<void> {
  void _supabase;
  const admin = adminClient();
  const row: Database["public"]["Tables"]["audit_tasks"]["Update"] = {};
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.score !== undefined) row.score = patch.score;
  if (patch.ruleConfigVersion !== undefined) {
    row.rule_config_version = patch.ruleConfigVersion;
  }

  const { error } = await admin
    .from("audit_tasks")
    .update(row)
    .eq("id", taskId)
    .eq("user_id", userId);

  if (error && patch.ruleConfigVersion !== undefined && isUnknownColumnError(error)) {
    const fallback: Database["public"]["Tables"]["audit_tasks"]["Update"] = {
      ...row,
    };
    delete fallback.rule_config_version;
    const { error: retryError } = await admin
      .from("audit_tasks")
      .update(fallback)
      .eq("id", taskId)
      .eq("user_id", userId);
    if (retryError) {
      throwDb(retryError, "更新审计任务");
    }
    return;
  }

  if (error) {
    throwDb(error, "更新审计任务");
  }
}

export async function persistAuditResults(
  _supabase: DbClient,
  taskId: string,
  userId: string,
  state: AuditGraphState,
): Promise<void> {
  void _supabase;
  const admin = adminClient();

  const buildRows = (includeWorkflow: boolean) => [
    ...state.issues.map((issue) =>
      issueToRow(taskId, issue, state.records, includeWorkflow),
    ),
    ...state.anomalies.map((anomaly) =>
      anomalyToIssueRow(taskId, anomaly, state.records, includeWorkflow),
    ),
  ];

  const issueRows = buildRows(true);

  if (issueRows.length > 0) {
    const { error: issuesError } = await admin
      .from("audit_issues")
      .insert(issueRows);

    if (issuesError && isUnknownColumnError(issuesError)) {
      const { error: retryError } = await admin
        .from("audit_issues")
        .insert(buildRows(false));
      if (retryError) {
        throwDb(retryError, "写入审计问题");
      }
    } else if (issuesError) {
      throwDb(issuesError, "写入审计问题");
    }
  }

  if (state.report) {
    const { error: reportError } = await admin.from("audit_reports").insert({
      task_id: taskId,
      content: state.report,
    });

    if (reportError) {
      throwDb(reportError, "写入审计报告");
    }
  }

  await updateAuditTask(admin as DbClient, taskId, userId, {
    status: state.status,
    score: state.score ?? null,
    ruleConfigVersion: state.ruleConfig?.version ?? null,
  });
}
