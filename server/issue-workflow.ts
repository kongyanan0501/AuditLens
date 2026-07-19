import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { countIssueAttachments } from "@/server/issue-attachments";
import type {
  IssueWorkflowEvent,
  IssueWorkflowStatus,
  UserRole,
} from "@/types/audit";
import type { Database } from "@/types/database";
import { mapIssueEventRow } from "@/types/database";

type DbClient = SupabaseClient<Database>;

const TRANSITIONS: Record<IssueWorkflowStatus, IssueWorkflowStatus[]> = {
  pending_review: ["confirmed", "false_positive"],
  confirmed: ["remediating", "closed"],
  false_positive: ["closed", "pending_review"],
  remediating: ["pending_verification", "confirmed"],
  pending_verification: ["closed", "remediating"],
  closed: ["pending_review"],
};

export const WORKFLOW_STATUS_LABELS: Record<IssueWorkflowStatus, string> = {
  pending_review: "待复核",
  confirmed: "确认风险",
  false_positive: "误报",
  remediating: "整改中",
  pending_verification: "待验收",
  closed: "已关闭",
};

const MIN_REMEDIATION_TEXT = 10;

function isWorkflowStatus(value: string): value is IssueWorkflowStatus {
  return value in TRANSITIONS;
}

export function allowedTransitions(
  from: IssueWorkflowStatus,
): IssueWorkflowStatus[] {
  return TRANSITIONS[from] ?? [];
}

function dbMessage(error: unknown): string {
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
  const message = dbMessage(error);
  const hint =
    message.includes("schema cache") || message.includes("PGRST205")
      ? "。请在 Supabase SQL Editor 执行 notify pgrst, 'reload schema';，或 Pause 后再 Restore 项目"
      : "";
  throw new Error(`[${step}] ${message}${hint}`);
}

export type TransitionIssueInput = {
  issueId: string;
  actorId: string;
  actorRole: UserRole;
  toStatus: IssueWorkflowStatus;
  note?: string;
  assigneeId?: string | null;
  remediationAction?: string;
  remediationResult?: string;
};

export type TransitionIssueResult = {
  id: string;
  workflowStatus: IssueWorkflowStatus;
  assigneeId: string | null;
  resolutionNote: string | null;
  statusUpdatedAt: string | null;
  statusUpdatedBy: string | null;
  remediationAction: string | null;
  remediationResult: string | null;
  remediationSubmittedAt: string | null;
  remediationSubmittedBy: string | null;
};

export async function listIssueEvents(
  _supabase: DbClient,
  issueId: string,
): Promise<IssueWorkflowEvent[]> {
  void _supabase;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("audit_issue_events")
    .select("*")
    .eq("issue_id", issueId)
    .order("created_at", { ascending: true });

  if (error) {
    if (
      dbMessage(error).includes("schema cache") ||
      dbMessage(error).includes("PGRST205")
    ) {
      return [];
    }
    throwDb(error, "读取工单轨迹");
  }

  return (data ?? []).map((row) => {
    const mapped = mapIssueEventRow(row);
    return {
      id: mapped.id,
      issueId: mapped.issueId,
      actorId: mapped.actorId,
      fromStatus: mapped.fromStatus,
      toStatus: mapped.toStatus,
      note: mapped.note,
      createdAt: mapped.createdAt,
    };
  });
}

export async function transitionIssue(
  _supabase: DbClient,
  input: TransitionIssueInput,
): Promise<TransitionIssueResult> {
  void _supabase;
  const admin = createAdminClient();

  const { data: issue, error: loadError } = await admin
    .from("audit_issues")
    .select(
      "id, workflow_status, assignee_id, resolution_note, task_id, status_updated_at, status_updated_by, remediation_action, remediation_result, remediation_submitted_at, remediation_submitted_by",
    )
    .eq("id", input.issueId)
    .maybeSingle();

  if (loadError) {
    throwDb(loadError, "读取问题");
  }
  if (!issue) {
    throw new Error("问题不存在或无权访问");
  }

  const { data: task, error: taskError } = await admin
    .from("audit_tasks")
    .select("user_id")
    .eq("id", issue.task_id)
    .maybeSingle();

  if (taskError) {
    throwDb(taskError, "读取任务");
  }

  const isTaskOwner = task?.user_id === input.actorId;
  const isAssignee = issue.assignee_id === input.actorId;
  const isAuditor = input.actorRole === "auditor";

  if (!isTaskOwner && !isAssignee && !isAuditor) {
    throw new Error("无权更新该问题");
  }

  if (input.actorRole === "business" && !isAssignee) {
    throw new Error("业务角色仅可操作分派给自己的问题");
  }

  const fromStatus = isWorkflowStatus(issue.workflow_status)
    ? issue.workflow_status
    : "pending_review";

  if (!allowedTransitions(fromStatus).includes(input.toStatus)) {
    throw new Error(
      `不允许从「${WORKFLOW_STATUS_LABELS[fromStatus]}」转为「${WORKFLOW_STATUS_LABELS[input.toStatus]}」。`,
    );
  }

  if (fromStatus === "remediating" && input.toStatus === "closed") {
    throw new Error("关闭前须经「待验收」；请先提交整改并由审计验收");
  }

  if (input.actorRole === "business") {
    if (
      fromStatus !== "remediating" ||
      input.toStatus !== "pending_verification"
    ) {
      throw new Error("业务角色仅可提交「整改中」问题进入待验收");
    }
  }

  if (
    input.actorRole === "auditor" &&
    fromStatus === "remediating" &&
    input.toStatus === "pending_verification"
  ) {
    throw new Error("仅分派业务人员可提交整改验收");
  }

  let nextAssignee = issue.assignee_id;
  if (input.assigneeId !== undefined) {
    if (input.actorRole !== "auditor" && !isTaskOwner) {
      throw new Error("仅审计角色可分派问题");
    }
    nextAssignee = input.assigneeId;
  }

  if (input.toStatus === "remediating" && fromStatus === "confirmed" && !nextAssignee) {
    throw new Error("进入整改中前须指定分派人（填写用户 UUID）");
  }

  const note = input.note?.trim() || null;
  if (input.toStatus === "pending_review" && fromStatus !== "pending_review") {
    if (!note) {
      throw new Error("重新打开为待复核时须填写备注");
    }
  }

  if (
    fromStatus === "pending_verification" &&
    input.toStatus === "remediating"
  ) {
    if (!note) {
      throw new Error("驳回整改时须填写原因");
    }
  }

  let remediationAction = issue.remediation_action;
  let remediationResult = issue.remediation_result;
  let remediationSubmittedAt = issue.remediation_submitted_at;
  let remediationSubmittedBy = issue.remediation_submitted_by;
  let eventNote = note;

  if (input.toStatus === "pending_verification") {
    const action = (input.remediationAction ?? "").trim();
    const result = (input.remediationResult ?? "").trim();
    if (action.length < MIN_REMEDIATION_TEXT) {
      throw new Error(`措施说明至少 ${MIN_REMEDIATION_TEXT} 个字`);
    }
    if (result.length < MIN_REMEDIATION_TEXT) {
      throw new Error(`完成说明至少 ${MIN_REMEDIATION_TEXT} 个字`);
    }
    const attachmentCount = await countIssueAttachments(input.issueId);
    if (attachmentCount < 1) {
      throw new Error("提交验收前须至少上传 1 个证明附件或修正版流水");
    }
    remediationAction = action;
    remediationResult = result;
    remediationSubmittedAt = new Date().toISOString();
    remediationSubmittedBy = input.actorId;
    eventNote =
      note ??
      `措施：${action.slice(0, 80)}${action.length > 80 ? "…" : ""}；完成：${result.slice(0, 80)}${result.length > 80 ? "…" : ""}`;
  }

  const now = new Date().toISOString();

  const { data: updated, error: updateError } = await admin
    .from("audit_issues")
    .update({
      workflow_status: input.toStatus,
      assignee_id: nextAssignee,
      resolution_note: note ?? issue.resolution_note,
      status_updated_at: now,
      status_updated_by: input.actorId,
      remediation_action: remediationAction,
      remediation_result: remediationResult,
      remediation_submitted_at: remediationSubmittedAt,
      remediation_submitted_by: remediationSubmittedBy,
    })
    .eq("id", input.issueId)
    .select(
      "id, workflow_status, assignee_id, resolution_note, status_updated_at, status_updated_by, remediation_action, remediation_result, remediation_submitted_at, remediation_submitted_by",
    )
    .single();

  if (updateError) {
    throwDb(updateError, "更新工单状态");
  }

  const { error: eventError } = await admin.from("audit_issue_events").insert({
    issue_id: input.issueId,
    actor_id: input.actorId,
    from_status: fromStatus,
    to_status: input.toStatus,
    note: eventNote,
  });

  if (eventError) {
    console.warn("[issue-workflow] event insert failed:", dbMessage(eventError));
  }

  return {
    id: updated.id,
    workflowStatus: updated.workflow_status as IssueWorkflowStatus,
    assigneeId: updated.assignee_id,
    resolutionNote: updated.resolution_note,
    statusUpdatedAt: updated.status_updated_at,
    statusUpdatedBy: updated.status_updated_by,
    remediationAction: updated.remediation_action,
    remediationResult: updated.remediation_result,
    remediationSubmittedAt: updated.remediation_submitted_at,
    remediationSubmittedBy: updated.remediation_submitted_by,
  };
}
