import { NextResponse, type NextRequest } from "next/server";
import {
  createAuditTask,
  persistAuditResults,
  updateAuditTask,
} from "@/server/audit-repository";
import { runAuditGraph } from "@/server/langgraph";
import { createClientForRouteHandler } from "@/lib/supabase/route";

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_EXTENSIONS = [".xlsx", ".xls", ".csv"];

function getExtension(fileName: string): string {
  const index = fileName.lastIndexOf(".");
  if (index === -1) return "";
  return fileName.slice(index).toLowerCase();
}

function isAllowedFile(file: File): boolean {
  return ALLOWED_EXTENSIONS.includes(getExtension(file.name));
}

export async function POST(request: NextRequest) {
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

    const formData = await request.formData();
    const fileValue = formData.get("file");

    if (!(fileValue instanceof File)) {
      return NextResponse.json(
        { error: "请上传 Excel 或 CSV 文件", code: "MISSING_FILE" },
        { status: 400 },
      );
    }

    if (!isAllowedFile(fileValue)) {
      return NextResponse.json(
        { error: "仅支持 .xlsx、.xls、.csv 格式", code: "INVALID_FILE_TYPE" },
        { status: 400 },
      );
    }

    if (fileValue.size === 0) {
      return NextResponse.json(
        { error: "文件不能为空", code: "EMPTY_FILE" },
        { status: 400 },
      );
    }

    if (fileValue.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: "文件大小不能超过 5MB", code: "FILE_TOO_LARGE" },
        { status: 400 },
      );
    }

    const fileContent = new Uint8Array(await fileValue.arrayBuffer());
    const taskId = await createAuditTask(supabase, user.id, fileValue.name);

    await updateAuditTask(supabase, taskId, user.id, { status: "running" });

    const finalState = await runAuditGraph({
      taskId,
      userId: user.id,
      fileName: fileValue.name,
      fileContent,
    });

    if (finalState.status === "failed") {
      await updateAuditTask(supabase, taskId, user.id, { status: "failed" });
      return NextResponse.json(
        {
          error: finalState.error ?? "审计流水线执行失败",
          code: "AUDIT_FAILED",
          taskId,
        },
        { status: 422 },
      );
    }

    await persistAuditResults(supabase, taskId, user.id, finalState);

    const issueCount = finalState.issues.length + finalState.anomalies.length;
    const payload = {
      data: {
        taskId,
        score: finalState.score ?? null,
        issueCount,
        recordCount: finalState.records.length,
        status: finalState.status,
      },
    };

    const successResponse = NextResponse.json(payload, { status: 201 });
    response.cookies.getAll().forEach((cookie) => {
      successResponse.cookies.set(cookie);
    });

    return successResponse;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "服务器内部错误";

    return NextResponse.json(
      { error: message, code: "INTERNAL_ERROR" },
      { status: 500 },
    );
  }
}
