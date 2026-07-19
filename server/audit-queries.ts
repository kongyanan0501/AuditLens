import type { SupabaseClient } from "@supabase/supabase-js";
import { getEmailsByUserIds } from "@/server/profiles";
import type {
  AuditIssue,
  AuditReport,
  AuditTask,
  IssueSeverity,
  IssueType,
  IssueWorkflowStatus,
  TaskStatus,
  UserRole,
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
    workflowStatus: mapped.workflowStatus as IssueWorkflowStatus,
    assigneeId: mapped.assigneeId,
    resolutionNote: mapped.resolutionNote,
    statusUpdatedAt: mapped.statusUpdatedAt,
    statusUpdatedBy: mapped.statusUpdatedBy,
    remediationAction: mapped.remediationAction,
    remediationResult: mapped.remediationResult,
    remediationSubmittedAt: mapped.remediationSubmittedAt,
    remediationSubmittedBy: mapped.remediationSubmittedBy,
  };
}

async function withAssigneeEmails(issues: AuditIssue[]): Promise<AuditIssue[]> {
  const ids = issues
    .map((issue) => issue.assigneeId)
    .filter((id): id is string => Boolean(id));
  const emailMap = await getEmailsByUserIds(ids);
  return issues.map((issue) => ({
    ...issue,
    assigneeEmail: issue.assigneeId
      ? (emailMap.get(issue.assigneeId) ?? null)
      : null,
  }));
}

export type AuditTaskBundle = {
  task: AuditTask;
  issues: AuditIssue[];
  report: AuditReport | null;
};

export async function listUserAuditTasks(
  supabase: DbClient,
  _userId: string,
  limit = 10,
): Promise<AuditTask[]> {
  // RLS: auditor sees all; others see owned / assigned-issue tasks
  const { data, error } = await supabase
    .from("audit_tasks")
    .select("*")
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

/** Business inbox: issues assigned to the current user (cross-task). */
export async function listAssignedIssues(
  supabase: DbClient,
  userId: string,
  limit = 50,
): Promise<AuditIssue[]> {
  const { data, error } = await supabase
    .from("audit_issues")
    .select("*")
    .eq("assignee_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return withAssigneeEmails((data ?? []).map(mapRowToAuditIssue));
}

export async function getLatestCompletedTaskBundle(
  supabase: DbClient,
  userId: string,
  role: UserRole = "auditor",
): Promise<AuditTaskBundle | null> {
  const { data: taskRow, error } = await supabase
    .from("audit_tasks")
    .select("id")
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

  return getAuditTaskBundle(supabase, taskRow.id, userId, role);
}

export async function getAuditTaskBundle(
  supabase: DbClient,
  taskId: string,
  userId: string,
  role: UserRole = "auditor",
): Promise<AuditTaskBundle | null> {
  // Rely on RLS for access (owner or assignee)
  const { data: taskRow, error: taskError } = await supabase
    .from("audit_tasks")
    .select("*")
    .eq("id", taskId)
    .maybeSingle();

  if (taskError) {
    throw taskError;
  }
  if (!taskRow) {
    return null;
  }

  let issuesQuery = supabase
    .from("audit_issues")
    .select("*")
    .eq("task_id", taskId)
    .order("created_at", { ascending: true });

  if (role === "business") {
    issuesQuery = issuesQuery.eq("assignee_id", userId);
  }

  const { data: issueRows, error: issuesError } = await issuesQuery;

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
    issues: await withAssigneeEmails(
      (issueRows ?? []).map(mapRowToAuditIssue),
    ),
    report: reportRow ? mapReportRow(reportRow) : null,
  };
}
