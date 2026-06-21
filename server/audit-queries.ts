import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AuditIssue,
  AuditReport,
  AuditTask,
  IssueSeverity,
  IssueType,
  TaskStatus,
} from "@/types/audit";
import type { Database } from "@/types/database";
import { mapIssueRow, mapReportRow, mapTaskRow } from "@/types/database";

type DbClient = SupabaseClient<Database>;

function mapRowToAuditIssue(
  row: Database["public"]["Tables"]["audit_issues"]["Row"],
): AuditIssue {
  const mapped = mapIssueRow(row);
  const metadata =
    mapped.metadata &&
    typeof mapped.metadata === "object" &&
    !Array.isArray(mapped.metadata)
      ? (mapped.metadata as Record<string, unknown>)
      : undefined;

  return {
    id: mapped.id,
    taskId: mapped.taskId,
    type: mapped.type as IssueType,
    severity: mapped.severity as IssueSeverity,
    reason: mapped.reason,
    metadata,
  };
}

export type AuditTaskBundle = {
  task: AuditTask;
  issues: AuditIssue[];
  report: AuditReport | null;
};

export async function listUserAuditTasks(
  supabase: DbClient,
  userId: string,
  limit = 10,
): Promise<AuditTask[]> {
  const { data, error } = await supabase
    .from("audit_tasks")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => {
    const task = mapTaskRow(row);
    return {
      ...task,
      status: task.status as TaskStatus,
    };
  });
}

export async function getLatestCompletedTaskBundle(
  supabase: DbClient,
  userId: string,
): Promise<AuditTaskBundle | null> {
  const { data: taskRow, error } = await supabase
    .from("audit_tasks")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }
  if (!taskRow) {
    return null;
  }

  return getAuditTaskBundle(supabase, taskRow.id, userId);
}

export async function getAuditTaskBundle(
  supabase: DbClient,
  taskId: string,
  userId: string,
): Promise<AuditTaskBundle | null> {
  const { data: taskRow, error: taskError } = await supabase
    .from("audit_tasks")
    .select("*")
    .eq("id", taskId)
    .eq("user_id", userId)
    .maybeSingle();

  if (taskError) {
    throw taskError;
  }
  if (!taskRow) {
    return null;
  }

  const { data: issueRows, error: issuesError } = await supabase
    .from("audit_issues")
    .select("*")
    .eq("task_id", taskId)
    .order("created_at", { ascending: true });

  if (issuesError) {
    throw issuesError;
  }

  const { data: reportRow, error: reportError } = await supabase
    .from("audit_reports")
    .select("*")
    .eq("task_id", taskId)
    .maybeSingle();

  if (reportError) {
    throw reportError;
  }

  const task = mapTaskRow(taskRow);

  return {
    task: {
      ...task,
      status: task.status as TaskStatus,
    },
    issues: (issueRows ?? []).map(mapRowToAuditIssue),
    report: reportRow ? mapReportRow(reportRow) : null,
  };
}
