import { NextResponse, type NextRequest } from "next/server";
import {
  listIssueEvents,
  transitionIssue,
  WORKFLOW_STATUS_LABELS,
} from "@/server/issue-workflow";
import { getUserRole } from "@/server/profiles";
import { createClientForRouteHandler } from "@/lib/supabase/route";
import type { IssueWorkflowStatus } from "@/types/audit";
import { ISSUE_WORKFLOW_STATUSES } from "@/types/audit";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function isWorkflowStatus(value: unknown): value is IssueWorkflowStatus {
  return (
    typeof value === "string" &&
    (ISSUE_WORKFLOW_STATUSES as string[]).includes(value)
  );
}

function errorStatus(message: string): number {
  if (message.includes("不允许")) return 409;
  if (
    message.includes("无权") ||
    message.includes("须") ||
    message.includes("至少") ||
    message.includes("仅") ||
    message.includes("无效") ||
    message.includes("不能")
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

    const events = await listIssueEvents(supabase, id);
    const payload = NextResponse.json({
      data: {
        events,
        statusLabels: WORKFLOW_STATUS_LABELS,
      },
    });
    response.cookies.getAll().forEach((cookie) => {
      payload.cookies.set(cookie);
    });
    return payload;
  } catch (error) {
    const message = error instanceof Error ? error.message : "服务器内部错误";
    return NextResponse.json(
      { error: message, code: "INTERNAL_ERROR" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
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

    const body = (await request.json()) as {
      toStatus?: unknown;
      note?: unknown;
      assigneeId?: unknown;
      remediationAction?: unknown;
      remediationResult?: unknown;
    };

    if (!isWorkflowStatus(body.toStatus)) {
      return NextResponse.json(
        { error: "无效的工单状态", code: "INVALID_STATUS" },
        { status: 400 },
      );
    }

    const role = await getUserRole(supabase, user.id);
    const result = await transitionIssue(supabase, {
      issueId: id,
      actorId: user.id,
      actorRole: role,
      toStatus: body.toStatus,
      note: typeof body.note === "string" ? body.note : undefined,
      assigneeId:
        body.assigneeId === null
          ? null
          : typeof body.assigneeId === "string"
            ? body.assigneeId
            : undefined,
      remediationAction:
        typeof body.remediationAction === "string"
          ? body.remediationAction
          : undefined,
      remediationResult:
        typeof body.remediationResult === "string"
          ? body.remediationResult
          : undefined,
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
    console.error("[api/issues PATCH]", error);
    const status = errorStatus(message);
    const code =
      status === 409
        ? "CONFLICT"
        : status === 400
          ? "BAD_REQUEST"
          : "INTERNAL_ERROR";
    return NextResponse.json({ error: message, code }, { status });
  }
}
