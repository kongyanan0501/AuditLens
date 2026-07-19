import {
  AIProviderError,
  createLLMProvider,
  hasLlmApiKey,
  type LLMProvider,
} from "@/lib/ai-provider";
import { getRiskLabel } from "@/lib/theme";
import { buildEvidenceSnapshot } from "@/server/evidence";
import type {
  AuditAnomaly,
  AuditGraphState,
  AuditIssue,
  AuditRecord,
  EvidenceRow,
  IssueSeverity,
  IssueType,
} from "@/types/audit";

const TYPE_LABELS: Record<IssueType, string> = {
  duplicate: "重复发票",
  anomaly: "金额异常",
  approval: "审批缺失",
  vendor_concentration: "供应商集中",
};

const SEVERITY_LABELS: Record<IssueSeverity, string> = {
  low: "低",
  medium: "中",
  high: "高",
};

export type ReportItem = AuditIssue | AuditAnomaly;

function allReportItems(
  state: Pick<AuditGraphState, "issues" | "anomalies">,
): ReportItem[] {
  return [...state.issues, ...state.anomalies];
}

function countByType(items: ReportItem[], type: IssueType): number {
  return items.filter((item) => item.type === type).length;
}

function countHighSeverity(items: ReportItem[]): number {
  return items.filter((item) => item.severity === "high").length;
}

function formatRecommendation(item: ReportItem): string | undefined {
  const recommendation = item.metadata?.recommendation;
  return typeof recommendation === "string" ? recommendation : undefined;
}

function parseEvidenceFromMetadata(
  metadata: Record<string, unknown> | undefined,
): EvidenceRow[] {
  const raw = metadata?.evidence;
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw.flatMap((entry) => {
    if (!entry || typeof entry !== "object") {
      return [];
    }
    const row = entry as Record<string, unknown>;
    if (
      typeof row.date !== "string" ||
      (row.type !== "income" && row.type !== "expense") ||
      typeof row.amount !== "number" ||
      typeof row.vendor !== "string" ||
      typeof row.invoiceId !== "string"
    ) {
      return [];
    }
    return [
      {
        date: row.date,
        type: row.type,
        amount: row.amount,
        vendor: row.vendor,
        invoiceId: row.invoiceId,
        ...(typeof row.department === "string"
          ? { department: row.department }
          : {}),
        ...(typeof row.region === "string" ? { region: row.region } : {}),
        ...(typeof row.approvedBy === "string"
          ? { approvedBy: row.approvedBy }
          : {}),
      },
    ];
  });
}

export function formatEvidenceMarkdown(evidence: EvidenceRow[]): string {
  if (evidence.length === 0) {
    return "";
  }

  const header = [
    "   - 关联凭证：",
    "     | 日期 | 类型 | 金额 | 供应商 | 发票号 | 审批人 |",
    "     | --- | --- | --- | --- | --- | --- |",
  ];

  const rows = evidence.map((row) => {
    const typeLabel = row.type === "expense" ? "支出" : "收入";
    const approvedBy = row.approvedBy?.trim() || "—";
    return `     | ${row.date} | ${typeLabel} | ${row.amount} | ${row.vendor} | ${row.invoiceId} | ${approvedBy} |`;
  });

  return [...header, ...rows].join("\n");
}

function resolveEvidence(
  item: ReportItem,
  records: AuditRecord[],
): EvidenceRow[] {
  const fromMeta = parseEvidenceFromMetadata(item.metadata);
  if (fromMeta.length > 0) {
    return fromMeta;
  }

  const recordIndex =
    "recordIndex" in item && typeof item.recordIndex === "number"
      ? item.recordIndex
      : undefined;

  return buildEvidenceSnapshot(records, {
    recordIndex,
    metadata: item.metadata,
  });
}

function formatRuleHitLine(metadata: Record<string, unknown> | undefined): string | null {
  if (!metadata) return null;
  const ruleId = typeof metadata.ruleId === "string" ? metadata.ruleId : null;
  if (!ruleId) return null;
  const version =
    typeof metadata.ruleVersion === "number" ? ` v${metadata.ruleVersion}` : "";
  const thresholds =
    metadata.thresholds && typeof metadata.thresholds === "object"
      ? `；阈值 ${JSON.stringify(metadata.thresholds)}`
      : "";
  return `   - 规则：${ruleId}${version}${thresholds}`;
}

function formatFindingLine(
  index: number,
  item: ReportItem,
  records: AuditRecord[],
): string {
  const severity = SEVERITY_LABELS[item.severity];
  const recommendation = formatRecommendation(item);
  const ruleHit = formatRuleHitLine(item.metadata);
  const evidenceMarkdown = formatEvidenceMarkdown(
    resolveEvidence(item, records),
  );
  const lines = [`${index}. **[${severity}]** ${item.reason}`];
  if (ruleHit) {
    lines.push(ruleHit);
  }
  if (recommendation) {
    lines.push(`   - 建议：${recommendation}`);
  }
  if (evidenceMarkdown) {
    lines.push(evidenceMarkdown);
  }
  return lines.join("\n");
}

function groupFindingsByType(items: ReportItem[]): Map<IssueType, ReportItem[]> {
  const groups = new Map<IssueType, ReportItem[]>();
  for (const item of items) {
    const list = groups.get(item.type) ?? [];
    list.push(item);
    groups.set(item.type, list);
  }
  return groups;
}

export function buildFindingsSection(
  state: Pick<AuditGraphState, "issues" | "anomalies" | "records">,
): string {
  const items = allReportItems(state);
  if (items.length === 0) {
    return "本次审计未发现规则命中或统计异常。";
  }

  const records = state.records ?? [];
  const groups = groupFindingsByType(items);
  const sections: string[] = [];

  for (const [type, groupItems] of groups) {
    const lines = groupItems.map((item, index) =>
      formatFindingLine(index + 1, item, records),
    );
    sections.push(
      `### ${TYPE_LABELS[type]}（${groupItems.length} 项）\n\n${lines.join("\n")}`,
    );
  }

  return sections.join("\n\n");
}

export function buildRecommendationsSection(
  state: Pick<AuditGraphState, "issues" | "anomalies">,
): string {
  const items = allReportItems(state);
  const recommendations = items.flatMap((item) => {
    const text = formatRecommendation(item);
    return text ? [{ type: item.type, text }] : [];
  });

  const uniqueByText = new Map<string, { type: IssueType; text: string }>();
  for (const entry of recommendations) {
    uniqueByText.set(entry.text, entry);
  }

  if (uniqueByText.size === 0) {
    return [
      "1. 复核全部 flagged 记录，补充原始凭证与审批链路。",
      "2. 对重复发票与缺失审批项建立专项台账，限期整改并二次抽检。",
      "3. 持续监控大额波动与供应商集中度，必要时触发二级审批。",
    ].join("\n");
  }

  return [...uniqueByText.values()]
    .map(
      (entry, index) =>
        `${index + 1}. **${TYPE_LABELS[entry.type]}**：${entry.text}`,
    )
    .join("\n");
}

export function buildExecutiveSummary(
  state: Pick<
    AuditGraphState,
    "fileName" | "records" | "issues" | "anomalies" | "score"
  >,
): string {
  const items = allReportItems(state);
  const highCount = countHighSeverity(items);
  const score = state.score ?? 0;
  const tierLabel = getRiskLabel(state.score ?? null);

  if (items.length === 0) {
    return [
      `本次审计共分析 **${state.records.length}** 条财务记录，未发现显著风险信号。`,
      `综合风险评分为 **${score}**（${tierLabel}）。`,
      "建议保持现有内控流程，并定期复核关键供应商与审批链路。",
    ].join("\n");
  }

  return [
    `本次审计共分析 **${state.records.length}** 条财务记录，发现 **${items.length}** 项风险信号（含 **${highCount}** 项高风险）。`,
    `综合风险评分为 **${score}**（${tierLabel}）。`,
    "建议优先复核高风险项，并对重复发票、审批缺失等问题完成整改闭环。",
  ].join("\n");
}

export function buildRiskAnalysisSection(
  state: Pick<AuditGraphState, "issues" | "anomalies" | "score">,
): string {
  const items = allReportItems(state);
  const score = state.score ?? 0;
  const tierLabel = getRiskLabel(state.score ?? null);

  return [
    "| 维度 | 结果 |",
    "| --- | --- |",
    `| 综合风险评分 | ${score}/100（${tierLabel}） |`,
    `| 问题总数 | ${items.length} |`,
    `| 高风险项 | ${countHighSeverity(items)} |`,
    `| 重复发票 | ${countByType(items, "duplicate")} |`,
    `| 审批缺失 | ${countByType(items, "approval")} |`,
    `| 金额异常 | ${countByType(items, "anomaly")} |`,
    `| 供应商集中 | ${countByType(items, "vendor_concentration")} |`,
    "",
    "评分公式：`100 - 重复×10 - 异常×5 - 审批缺失×8`（结果限制在 0–100）",
  ].join("\n");
}

export function buildDeterministicReport(
  state: Pick<
    AuditGraphState,
    | "fileName"
    | "records"
    | "issues"
    | "anomalies"
    | "score"
    | "explanations"
  >,
): string {
  const fileName = state.fileName ?? "—";
  const score = state.score ?? 0;

  return [
    "# 审计报告",
    "",
    `> 文件名：${fileName} · 分析记录 ${state.records.length} 条 · 综合风险评分 **${score}** / 100`,
    "",
    "## 执行摘要",
    "",
    buildExecutiveSummary(state),
    "",
    "## 发现项",
    "",
    buildFindingsSection(state),
    "",
    "## 风险分析",
    "",
    buildRiskAnalysisSection(state),
    "",
    "## 整改建议",
    "",
    buildRecommendationsSection(state),
    "",
    "---",
    "*本报告由 AuditLens 自动生成。*",
  ].join("\n");
}

export function buildReportPrompt(
  state: Pick<
    AuditGraphState,
    | "fileName"
    | "records"
    | "issues"
    | "anomalies"
    | "score"
    | "explanations"
  >,
): string {
  const items = allReportItems(state);
  const findingsPreview = items
    .slice(0, 12)
    .map(
      (item, index) =>
        `${index + 1}. [${SEVERITY_LABELS[item.severity]}] ${TYPE_LABELS[item.type]}：${item.reason}`,
    )
    .join("\n");

  return [
    "你是一名财务审计报告撰写助手。请根据以下审计结果，用中文撰写结构化 Markdown 报告。",
    "",
    "## 输入数据",
    `- 文件名：${state.fileName ?? "—"}`,
    `- 记录数：${state.records.length}`,
    `- 综合风险评分：${state.score ?? "—"}/100（${getRiskLabel(state.score ?? null)}）`,
    `- 问题总数：${items.length}`,
    `- 高风险项：${countHighSeverity(items)}`,
    "",
    "### 发现项摘要",
    findingsPreview || "（无）",
    "",
    "## 输出要求",
    "仅返回 Markdown，不要代码块。必须包含且仅使用以下四个二级标题（##）：",
    "1. ## 执行摘要 — 2-4 句，概括风险等级与关键发现",
    "2. ## 发现项 — 按问题类型分组，列出具体发现（含严重程度）",
    "3. ## 风险分析 — 用表格或列表说明评分、问题分布与内控影响",
    "4. ## 整改建议 — 编号列表，给出可执行建议",
    "",
    "语气专业、简洁，面向财务与内控人员。",
  ].join("\n");
}

function normalizeLlmReport(raw: string, state: AuditGraphState): string {
  const trimmed = raw.trim();
  const withoutFence = trimmed
    .replace(/^```(?:markdown|md)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const hasRequiredSections =
    withoutFence.includes("## 执行摘要") &&
    withoutFence.includes("## 发现项") &&
    withoutFence.includes("## 风险分析") &&
    withoutFence.includes("## 整改建议");

  if (!hasRequiredSections) {
    return buildDeterministicReport(state);
  }

  const fileName = state.fileName ?? "—";
  const score = state.score ?? 0;
  const header = [
    "# 审计报告",
    "",
    `> 文件名：${fileName} · 分析记录 ${state.records.length} 条 · 综合风险评分 **${score}** / 100`,
    "",
  ].join("\n");

  const body = withoutFence.startsWith("#")
    ? withoutFence.replace(/^#\s+.+\n+/, "")
    : withoutFence;

  return `${header}${body}\n\n---\n*本报告由 AuditLens 自动生成（AI 增强）。*`;
}

export type ReportDependencies = {
  llm: LLMProvider;
};

export async function runReportGeneration(
  state: AuditGraphState,
  deps?: Partial<ReportDependencies>,
): Promise<string> {
  if (!hasLlmApiKey()) {
    return buildDeterministicReport(state);
  }

  let llm: LLMProvider;
  try {
    llm = deps?.llm ?? createLLMProvider();
  } catch (error) {
    if (error instanceof AIProviderError) {
      return buildDeterministicReport(state);
    }
    throw error;
  }

  try {
    const prompt = buildReportPrompt(state);
    const raw = await llm.chat(prompt);
    return normalizeLlmReport(raw, state);
  } catch {
    return buildDeterministicReport(state);
  }
}
