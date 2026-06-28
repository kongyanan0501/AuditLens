import { NextResponse, type NextRequest } from "next/server";
import {
  createAuditTask,
  persistAuditResults,
  updateAuditTask,
} from "@/server/audit-repository";
import { runAuditGraph } from "@/server/langgraph";
import { createClientForRouteHandler } from "@/lib/supabase/route";
import { validateUploadFile } from "@/lib/upload-constraints";

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

    const validation = validateUploadFile(fileValue);
    if (!validation.ok) {
      return NextResponse.json(
        { error: validation.message, code: validation.code },
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
