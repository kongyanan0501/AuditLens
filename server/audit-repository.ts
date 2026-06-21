import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AuditAnomaly,
  AuditGraphState,
  AuditIssue,
} from "@/types/audit";
import type { Database, Json } from "@/types/database";

type DbClient = SupabaseClient<Database>;

function toJsonMetadata(metadata: Record<string, unknown> | undefined): Json {
  return (metadata ?? {}) as Json;
}

function anomalyToIssueRow(taskId: string, anomaly: AuditAnomaly) {
  return {
    task_id: taskId,
    type: anomaly.type,
    severity: anomaly.severity,
    reason: anomaly.reason,
    metadata: toJsonMetadata({
      ...anomaly.metadata,
      recordIndex: anomaly.recordIndex,
    }),
  };
}

function issueToRow(taskId: string, issue: AuditIssue) {
  return {
    task_id: taskId,
    type: issue.type,
    severity: issue.severity,
    reason: issue.reason,
    metadata: toJsonMetadata(issue.metadata),
  };
}

export async function createAuditTask(
  supabase: DbClient,
  userId: string,
  fileName: string,
): Promise<string> {
  const { data, error } = await supabase
    .from("audit_tasks")
    .insert({
      user_id: userId,
      file_name: fileName,
      status: "pending",
    })
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  return data.id;
}

export async function updateAuditTask(
  supabase: DbClient,
  taskId: string,
  userId: string,
  patch: {
    status?: AuditGraphState["status"];
    score?: number | null;
  },
): Promise<void> {
  const { error } = await supabase
    .from("audit_tasks")
    .update(patch)
    .eq("id", taskId)
    .eq("user_id", userId);

  if (error) {
    throw error;
  }
}

export async function persistAuditResults(
  supabase: DbClient,
  taskId: string,
  userId: string,
  state: AuditGraphState,
): Promise<void> {
  const issueRows = [
    ...state.issues.map((issue) => issueToRow(taskId, issue)),
    ...state.anomalies.map((anomaly) => anomalyToIssueRow(taskId, anomaly)),
  ];

  if (issueRows.length > 0) {
    const { error: issuesError } = await supabase
      .from("audit_issues")
      .insert(issueRows);

    if (issuesError) {
      throw issuesError;
    }
  }

  if (state.report) {
    const { error: reportError } = await supabase.from("audit_reports").insert({
      task_id: taskId,
      content: state.report,
    });

    if (reportError) {
      throw reportError;
    }
  }

  await updateAuditTask(supabase, taskId, userId, {
    status: state.status,
    score: state.score ?? null,
  });
}
