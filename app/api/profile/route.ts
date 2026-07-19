import { NextResponse, type NextRequest } from "next/server";
import {
  ensureProfile,
  updateUserRole,
} from "@/server/profiles";
import { createClientForRouteHandler } from "@/lib/supabase/route";
import type { UserRole } from "@/types/audit";

function isUserRole(value: unknown): value is UserRole {
  return value === "auditor" || value === "business";
}

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

    const profile = await ensureProfile(supabase, user.id);
    const payload = NextResponse.json({ data: profile });
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

export async function PATCH(request: NextRequest) {
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

    if (process.env.ALLOW_DEMO_ROLE_SWITCH !== "true") {
      return NextResponse.json(
        {
          error: "未开启演示角色切换；请在库中更新 profiles.role",
          code: "ROLE_SWITCH_DISABLED",
        },
        { status: 403 },
      );
    }

    const body = (await request.json()) as { role?: unknown };
    if (!isUserRole(body.role)) {
      return NextResponse.json(
        { error: "角色须为 auditor 或 business", code: "INVALID_ROLE" },
        { status: 400 },
      );
    }

    const profile = await updateUserRole(supabase, user.id, body.role);
    const payload = NextResponse.json({ data: profile });
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
