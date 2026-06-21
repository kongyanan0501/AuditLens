import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { computeRiskScore } from "@/server/audit-engine";
import { runAnomalyDetection } from "@/server/anomaly";
import { parseFinancialFile, ParseExcelError } from "@/server/parse-excel";
import { runRuleCheck } from "@/server/rules";
import type {
  AuditAnomaly,
  AuditGraphState,
  AuditIssue,
  AuditRecord,
  IssueExplanation,
  TaskStatus,
} from "@/types/audit";

const AuditStateAnnotation = Annotation.Root({
  taskId: Annotation<string | undefined>,
  userId: Annotation<string | undefined>,
  fileName: Annotation<string | undefined>,
  fileContent: Annotation<Uint8Array | undefined>,
  records: Annotation<AuditRecord[]>,
  issues: Annotation<AuditIssue[]>,
  anomalies: Annotation<AuditAnomaly[]>,
  score: Annotation<number | undefined>,
  explanations: Annotation<IssueExplanation[]>,
  report: Annotation<string | undefined>,
  status: Annotation<TaskStatus>,
  error: Annotation<string | undefined>,
});

type GraphState = typeof AuditStateAnnotation.State;

async function parseExcelNode(state: GraphState): Promise<Partial<GraphState>> {
  if (!state.fileContent || !state.fileName) {
    return { status: "failed", error: "缺少上传文件" };
  }

  try {
    const records = parseFinancialFile(state.fileName, state.fileContent);
    return {
      records,
      status: "running",
      fileContent: undefined,
      error: undefined,
    };
  } catch (error) {
    const message =
      error instanceof ParseExcelError
        ? error.message
        : error instanceof Error
          ? error.message
          : "文件解析失败";

    return { status: "failed", error: message };
  }
}

async function ruleCheckNode(state: GraphState): Promise<Partial<GraphState>> {
  return { issues: runRuleCheck(state.records) };
}

async function anomalyDetectionNode(
  state: GraphState,
): Promise<Partial<GraphState>> {
  return { anomalies: runAnomalyDetection(state.records) };
}

async function riskScoringNode(
  state: GraphState,
): Promise<Partial<GraphState>> {
  return { score: computeRiskScore(state) };
}

/** Phase 7 占位：暂不调用 LLM */
async function ragExplainNode(state: GraphState): Promise<Partial<GraphState>> {
  void state;
  return { explanations: [] };
}

/** Phase 8 占位：结构化 Markdown 报告 */
async function reportGenerationNode(
  state: GraphState,
): Promise<Partial<GraphState>> {
  const issueCount = state.issues.length + state.anomalies.length;
  const report = [
    "# 审计报告（Phase 6 占位）",
    "",
    `- 文件名：${state.fileName ?? "—"}`,
    `- 记录数：${state.records.length}`,
    `- 风险评分：**${state.score ?? "—"}**`,
    `- 发现问题：**${issueCount}** 项`,
    "",
    "完整 LLM 报告将在 Phase 7/8 生成。",
  ].join("\n");

  return { report, status: "completed" };
}

function routeAfterParse(state: GraphState): "ruleCheck" | typeof END {
  if (state.status === "failed" || state.error) {
    return END;
  }
  return "ruleCheck";
}

export function buildAuditGraph() {
  return new StateGraph(AuditStateAnnotation)
    .addNode("parseExcel", parseExcelNode)
    .addNode("ruleCheck", ruleCheckNode)
    .addNode("anomalyDetection", anomalyDetectionNode)
    .addNode("riskScoring", riskScoringNode)
    .addNode("ragExplain", ragExplainNode)
    .addNode("reportGeneration", reportGenerationNode)
    .addEdge(START, "parseExcel")
    .addConditionalEdges("parseExcel", routeAfterParse, {
      ruleCheck: "ruleCheck",
      [END]: END,
    })
    .addEdge("ruleCheck", "anomalyDetection")
    .addEdge("anomalyDetection", "riskScoring")
    .addEdge("riskScoring", "ragExplain")
    .addEdge("ragExplain", "reportGeneration")
    .addEdge("reportGeneration", END)
    .compile();
}

export type RunAuditGraphInput = Partial<AuditGraphState> & {
  fileName: string;
  fileContent: Uint8Array;
};

export async function runAuditGraph(
  input: RunAuditGraphInput,
): Promise<AuditGraphState> {
  const app = buildAuditGraph();
  const initialState: GraphState = {
    taskId: input.taskId,
    userId: input.userId,
    fileName: input.fileName,
    fileContent: input.fileContent,
    records: input.records ?? [],
    issues: input.issues ?? [],
    anomalies: input.anomalies ?? [],
    score: input.score,
    explanations: input.explanations ?? [],
    report: input.report,
    status: "running",
    error: input.error,
  };

  const result = await app.invoke(initialState);
  return result as AuditGraphState;
}
