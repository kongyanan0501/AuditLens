import { NextResponse, type NextRequest } from "next/server";
import { assignTaskRemediation } from "@/server/issue-workflow";
import { getUserRole } from "@/server/profiles";
import { createClientForRouteHandler } from "@/lib/supabase/route";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function errorStatus(message: string): number {
  if (
    message.includes("无权") ||
    message.includes("须") ||
    message.includes("仅") ||
    message.includes("无效") ||
    message.includes("未找到") ||
    message.includes("邮箱") ||
    message.includes("没有可分派") ||
    message.includes("业务角色")
  ) {
    return 400;
  }
  if (message.includes("不存在")) {
    return 404;
  }
  return 500;
}

export async function POST(request: NextRequest, context: RouteContext) {
  const response = NextResponse.json({ ok: true });
  const { id: taskId } = await context.params;

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

    const body = (await request.json()) as {
      assigneeEmail?: unknown;
      note?: unknown;
    };

    if (typeof body.assigneeEmail !== "string" || !body.assigneeEmail.trim()) {
      return NextResponse.json(
        { error: "须填写业务用户邮箱", code: "BAD_REQUEST" },
        { status: 400 },
      );
    }

    const role = await getUserRole(supabase, user.id);
    const result = await assignTaskRemediation(supabase, {
      taskId,
      actorId: user.id,
      actorRole: role,
      assigneeEmail: body.assigneeEmail,
      note: typeof body.note === "string" ? body.note : undefined,
    });

    const payload = NextResponse.json({ data: result });
    response.cookies.getAll().forEach((cookie) => {
      payload.cookies.set(cookie);
    });
    return payload;
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : error &&
            typeof error === "object" &&
            "message" in error &&
            typeof (error as { message: unknown }).message === "string"
          ? (error as { message: string }).message
          : "服务器内部错误";
    console.error("[api/tasks/assign POST]", error);
    const status = errorStatus(message);
    return NextResponse.json(
      {
        error: message,
        code: status === 404 ? "NOT_FOUND" : status === 400 ? "BAD_REQUEST" : "INTERNAL_ERROR",
      },
      { status },
    );
  }
}
