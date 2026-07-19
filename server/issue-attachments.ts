import { createAdminClient } from "@/lib/supabase/admin";
import type {
  IssueAttachment,
  IssueAttachmentKind,
  UserRole,
} from "@/types/audit";
import { ISSUE_ATTACHMENT_KINDS } from "@/types/audit";
import { mapAttachmentRow } from "@/types/database";

export const ISSUE_REMEDIATION_BUCKET = "issue-remediation";
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const MAX_ATTACHMENTS_PER_ISSUE = 20;

const EVIDENCE_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/pdf",
]);

const CORRECTED_MIME = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
  "application/csv",
]);

function dbMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }
  return "数据库操作失败";
}

export function isAttachmentKind(value: unknown): value is IssueAttachmentKind {
  return (
    typeof value === "string" &&
    (ISSUE_ATTACHMENT_KINDS as string[]).includes(value)
  );
}

export function validateAttachmentFile(
  file: { mimeType: string; byteSize: number; fileName: string },
  kind: IssueAttachmentKind,
): { ok: true } | { ok: false; message: string } {
  if (!file.fileName.trim()) {
    return { ok: false, message: "文件名无效" };
  }
  if (file.byteSize <= 0) {
    return { ok: false, message: "文件为空" };
  }
  if (file.byteSize > MAX_ATTACHMENT_BYTES) {
    return { ok: false, message: "单文件不能超过 10MB" };
  }
  const mime = file.mimeType.toLowerCase();
  if (kind === "evidence" && !EVIDENCE_MIME.has(mime)) {
    return {
      ok: false,
      message: "证明材料仅支持 PNG / JPEG / WebP / PDF",
    };
  }
  if (kind === "corrected_file" && !CORRECTED_MIME.has(mime)) {
    return {
      ok: false,
      message: "修正版流水仅支持 xlsx / xls / csv",
    };
  }
  return { ok: true };
}

function guessMimeFromName(fileName: string, fallback: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".xlsx")) {
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  }
  if (lower.endsWith(".xls")) return "application/vnd.ms-excel";
  if (lower.endsWith(".csv")) return "text/csv";
  return fallback || "application/octet-stream";
}

function safeFileName(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, "_").slice(0, 180) || "file";
}

export async function countIssueAttachments(issueId: string): Promise<number> {
  const admin = createAdminClient();
  const { count, error } = await admin
    .from("audit_issue_attachments")
    .select("id", { count: "exact", head: true })
    .eq("issue_id", issueId);

  if (error) {
    if (
      dbMessage(error).includes("schema cache") ||
      dbMessage(error).includes("PGRST205")
    ) {
      return 0;
    }
    throw new Error(`[统计附件] ${dbMessage(error)}`);
  }
  return count ?? 0;
}

async function assertCanAccessIssue(
  issueId: string,
  actorId: string,
  actorRole: UserRole,
): Promise<{
  assigneeId: string | null;
  workflowStatus: string;
}> {
  const admin = createAdminClient();
  const { data: issue, error } = await admin
    .from("audit_issues")
    .select("id, assignee_id, workflow_status, task_id")
    .eq("id", issueId)
    .maybeSingle();

  if (error) {
    throw new Error(`[读取问题] ${dbMessage(error)}`);
  }
  if (!issue) {
    throw new Error("问题不存在或无权访问");
  }

  const { data: task } = await admin
    .from("audit_tasks")
    .select("user_id")
    .eq("id", issue.task_id)
    .maybeSingle();

  const isAssignee = issue.assignee_id === actorId;
  const isOwner = task?.user_id === actorId;
  const isAuditor = actorRole === "auditor";

  if (!isAuditor && !isAssignee && !isOwner) {
    throw new Error("无权访问该问题的附件");
  }

  return {
    assigneeId: issue.assignee_id,
    workflowStatus: issue.workflow_status,
  };
}

export async function listIssueAttachments(
  issueId: string,
  actorId: string,
  actorRole: UserRole,
): Promise<IssueAttachment[]> {
  await assertCanAccessIssue(issueId, actorId, actorRole);
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("audit_issue_attachments")
    .select("*")
    .eq("issue_id", issueId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`[列出附件] ${dbMessage(error)}`);
  }

  const rows = data ?? [];
  const results: IssueAttachment[] = [];

  for (const row of rows) {
    const mapped = mapAttachmentRow(row);
    const { data: signed, error: signError } = await admin.storage
      .from(ISSUE_REMEDIATION_BUCKET)
      .createSignedUrl(mapped.storagePath, 60 * 10);

    if (signError) {
      console.warn("[issue-attachments] signed url failed:", signError.message);
    }

    results.push({
      id: mapped.id,
      issueId: mapped.issueId,
      uploadedBy: mapped.uploadedBy,
      kind: mapped.kind as IssueAttachmentKind,
      fileName: mapped.fileName,
      mimeType: mapped.mimeType,
      byteSize: mapped.byteSize,
      storagePath: mapped.storagePath,
      createdAt: mapped.createdAt,
      signedUrl: signed?.signedUrl,
    });
  }

  return results;
}

export async function uploadIssueAttachment(input: {
  issueId: string;
  actorId: string;
  actorRole: UserRole;
  kind: IssueAttachmentKind;
  fileName: string;
  mimeType: string;
  bytes: Uint8Array;
}): Promise<IssueAttachment> {
  const issue = await assertCanAccessIssue(
    input.issueId,
    input.actorId,
    input.actorRole,
  );

  if (input.actorRole !== "business" || issue.assigneeId !== input.actorId) {
    throw new Error("仅分派业务人员可在整改中上传附件");
  }
  if (issue.workflowStatus !== "remediating") {
    throw new Error("仅「整改中」状态可上传附件");
  }

  const mimeType = guessMimeFromName(input.fileName, input.mimeType);
  const validation = validateAttachmentFile(
    {
      mimeType,
      byteSize: input.bytes.byteLength,
      fileName: input.fileName,
    },
    input.kind,
  );
  if (!validation.ok) {
    throw new Error(validation.message);
  }

  const existing = await countIssueAttachments(input.issueId);
  if (existing >= MAX_ATTACHMENTS_PER_ISSUE) {
    throw new Error(`单个问题最多 ${MAX_ATTACHMENTS_PER_ISSUE} 个附件`);
  }

  const admin = createAdminClient();
  const attachmentId = crypto.randomUUID();
  const storagePath = `${input.issueId}/${attachmentId}/${safeFileName(input.fileName)}`;

  const { data: inserted, error: insertError } = await admin
    .from("audit_issue_attachments")
    .insert({
      id: attachmentId,
      issue_id: input.issueId,
      uploaded_by: input.actorId,
      kind: input.kind,
      file_name: input.fileName,
      mime_type: mimeType,
      byte_size: input.bytes.byteLength,
      storage_path: storagePath,
    })
    .select("*")
    .single();

  if (insertError) {
    throw new Error(`[保存附件元数据] ${dbMessage(insertError)}`);
  }

  const { error: uploadError } = await admin.storage
    .from(ISSUE_REMEDIATION_BUCKET)
    .upload(storagePath, input.bytes, {
      contentType: mimeType,
      upsert: false,
    });

  if (uploadError) {
    await admin.from("audit_issue_attachments").delete().eq("id", attachmentId);
    throw new Error(`[上传文件] ${uploadError.message}`);
  }

  const mapped = mapAttachmentRow(inserted);
  const { data: signed } = await admin.storage
    .from(ISSUE_REMEDIATION_BUCKET)
    .createSignedUrl(storagePath, 60 * 10);

  return {
    id: mapped.id,
    issueId: mapped.issueId,
    uploadedBy: mapped.uploadedBy,
    kind: mapped.kind as IssueAttachmentKind,
    fileName: mapped.fileName,
    mimeType: mapped.mimeType,
    byteSize: mapped.byteSize,
    storagePath: mapped.storagePath,
    createdAt: mapped.createdAt,
    signedUrl: signed?.signedUrl,
  };
}

export async function deleteIssueAttachment(input: {
  issueId: string;
  attachmentId: string;
  actorId: string;
  actorRole: UserRole;
}): Promise<void> {
  const issue = await assertCanAccessIssue(
    input.issueId,
    input.actorId,
    input.actorRole,
  );

  if (issue.workflowStatus !== "remediating") {
    throw new Error("仅「整改中」状态可删除附件");
  }

  const admin = createAdminClient();
  const { data: row, error } = await admin
    .from("audit_issue_attachments")
    .select("*")
    .eq("id", input.attachmentId)
    .eq("issue_id", input.issueId)
    .maybeSingle();

  if (error) {
    throw new Error(`[读取附件] ${dbMessage(error)}`);
  }
  if (!row) {
    throw new Error("附件不存在");
  }
  if (row.uploaded_by !== input.actorId) {
    throw new Error("只能删除自己上传的附件");
  }

  await admin.storage.from(ISSUE_REMEDIATION_BUCKET).remove([row.storage_path]);

  const { error: deleteError } = await admin
    .from("audit_issue_attachments")
    .delete()
    .eq("id", input.attachmentId);

  if (deleteError) {
    throw new Error(`[删除附件] ${dbMessage(deleteError)}`);
  }
}
