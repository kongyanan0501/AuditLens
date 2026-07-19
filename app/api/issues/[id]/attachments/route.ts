import { NextResponse, type NextRequest } from "next/server";
import {
  deleteIssueAttachment,
  isAttachmentKind,
  listIssueAttachments,
  uploadIssueAttachment,
} from "@/server/issue-attachments";
import { getUserRole } from "@/server/profiles";
import { createClientForRouteHandler } from "@/lib/supabase/route";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function errorStatus(message: string): number {
  if (
    message.includes("无权") ||
    message.includes("仅") ||
    message.includes("须") ||
    message.includes("支持") ||
    message.includes("不能") ||
    message.includes("最多") ||
    message.includes("无效") ||
    message.includes("为空") ||
    message.includes("不存在")
  ) {
    return 400;
  }
  return 500;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const response = NextResponse.json({ ok: true });
  const { id } = await context.params;

  try {
    const supabase = createClientForRouteHandler(request, response);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "请先登录", code: "UNAUTHORIZED" },
        { status: 401 },
      );
    }

    const role = await getUserRole(supabase, user.id);
    const attachments = await listIssueAttachments(id, user.id, role);
    const payload = NextResponse.json({ data: attachments });
    response.cookies.getAll().forEach((cookie) => {
      payload.cookies.set(cookie);
    });
    return payload;
  } catch (error) {
    const message = error instanceof Error ? error.message : "服务器内部错误";
    return NextResponse.json(
      { error: message, code: errorStatus(message) === 400 ? "BAD_REQUEST" : "INTERNAL_ERROR" },
      { status: errorStatus(message) },
    );
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  const response = NextResponse.json({ ok: true });
  const { id } = await context.params;

  try {
    const supabase = createClientForRouteHandler(request, response);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "请先登录", code: "UNAUTHORIZED" },
        { status: 401 },
      );
    }

    const form = await request.formData();
    const file = form.get("file");
    const kindRaw = form.get("kind");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "请上传文件", code: "BAD_REQUEST" },
        { status: 400 },
      );
    }
    if (!isAttachmentKind(kindRaw)) {
      return NextResponse.json(
        { error: "kind 须为 evidence 或 corrected_file", code: "BAD_REQUEST" },
        { status: 400 },
      );
    }

    const role = await getUserRole(supabase, user.id);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const attachment = await uploadIssueAttachment({
      issueId: id,
      actorId: user.id,
      actorRole: role,
      kind: kindRaw,
      fileName: file.name,
      mimeType: file.type,
      bytes,
    });

    const payload = NextResponse.json({ data: attachment }, { status: 201 });
    response.cookies.getAll().forEach((cookie) => {
      payload.cookies.set(cookie);
    });
    return payload;
  } catch (error) {
    const message = error instanceof Error ? error.message : "服务器内部错误";
    console.error("[api/issues attachments POST]", error);
    return NextResponse.json(
      { error: message, code: errorStatus(message) === 400 ? "BAD_REQUEST" : "INTERNAL_ERROR" },
      { status: errorStatus(message) },
    );
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const response = NextResponse.json({ ok: true });
  const { id } = await context.params;

  try {
    const supabase = createClientForRouteHandler(request, response);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "请先登录", code: "UNAUTHORIZED" },
        { status: 401 },
      );
    }

    const attachmentId = new URL(request.url).searchParams.get("attachmentId");
    if (!attachmentId) {
      return NextResponse.json(
        { error: "缺少 attachmentId", code: "BAD_REQUEST" },
        { status: 400 },
      );
    }

    const role = await getUserRole(supabase, user.id);
    await deleteIssueAttachment({
      issueId: id,
      attachmentId,
      actorId: user.id,
      actorRole: role,
    });

    const payload = NextResponse.json({ data: { ok: true } });
    response.cookies.getAll().forEach((cookie) => {
      payload.cookies.set(cookie);
    });
    return payload;
  } catch (error) {
    const message = error instanceof Error ? error.message : "服务器内部错误";
    return NextResponse.json(
      { error: message, code: errorStatus(message) === 400 ? "BAD_REQUEST" : "INTERNAL_ERROR" },
      { status: errorStatus(message) },
    );
  }
}
