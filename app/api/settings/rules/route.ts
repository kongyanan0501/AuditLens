import { NextResponse, type NextRequest } from "next/server";
import { getUserRole } from "@/server/profiles";
import {
  getActiveRuleConfig,
  listRuleConfigHistory,
  publishRuleConfig,
} from "@/server/rule-config";
import { createClientForRouteHandler } from "@/lib/supabase/route";

export async function GET(request: NextRequest) {
  const response = NextResponse.json({ ok: true });

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

    const [config, history] = await Promise.all([
      getActiveRuleConfig(supabase),
      listRuleConfigHistory(supabase),
    ]);
    const payload = NextResponse.json({ data: { ...config, history } });
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

export async function PUT(request: NextRequest) {
  const response = NextResponse.json({ ok: true });

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
    if (role !== "auditor") {
      return NextResponse.json(
        { error: "仅审计角色可变更规则阈值", code: "FORBIDDEN" },
        { status: 403 },
      );
    }

    const body = (await request.json()) as {
      amountAnomalyMultiplier?: unknown;
      vendorConcentrationThreshold?: unknown;
      approvalRequiredMinAmount?: unknown;
      changeNote?: unknown;
      scopeKey?: unknown;
    };

    const published = await publishRuleConfig(supabase, user.id, {
      amountAnomalyMultiplier: Number(body.amountAnomalyMultiplier),
      vendorConcentrationThreshold: Number(body.vendorConcentrationThreshold),
      approvalRequiredMinAmount: Number(body.approvalRequiredMinAmount),
      changeNote:
        typeof body.changeNote === "string" ? body.changeNote : undefined,
      scopeKey: typeof body.scopeKey === "string" ? body.scopeKey : undefined,
    });

    const payload = NextResponse.json({ data: published });
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
    console.error("[api/settings/rules PUT]", error);
    const status =
      message.includes("须") ||
      message.includes("之间") ||
      message.includes("备注")
        ? 400
        : 500;
    return NextResponse.json(
      { error: message, code: status === 400 ? "BAD_REQUEST" : "INTERNAL_ERROR" },
      { status },
    );
  }
}
