import {
  AIProviderError,
  createLLMProvider,
  hasLlmApiKey,
  type LLMProvider,
} from "@/lib/ai-provider";
import {
  createVectorStore,
  VectorStoreError,
  type VectorStore,
} from "@/lib/pinecone";
import type {
  AuditAnomaly,
  AuditGraphState,
  AuditIssue,
  AuditRecord,
  IssueExplanation,
  IssueType,
  SearchResult,
} from "@/types/audit";

const DEFAULT_TOP_K = 5;

/** 知识库种子条目 — 与 scripts/seed-knowledge-base.ts 共享 */
export const KNOWLEDGE_SEED_ENTRIES = [
  {
    id: "550e8400-e29b-41d4-a716-446655440001",
    category: "duplicate",
    content:
      "同一 invoiceId 不得重复入账。重复发票可能导致虚增成本或重复付款，需立即核对原始凭证并作废重复条目。",
  },
  {
    id: "550e8400-e29b-41d4-a716-446655440002",
    category: "approval",
    content:
      "所有支出类交易须经授权审批人签字或系统审批后方可入账。缺少审批的记录存在内控缺陷风险。",
  },
  {
    id: "550e8400-e29b-41d4-a716-446655440003",
    category: "anomaly",
    content:
      "单笔金额超过历史均值 5 倍需触发二级审批与异常说明。大额波动可能暗示录入错误或潜在舞弊。",
  },
  {
    id: "550e8400-e29b-41d4-a716-446655440004",
    category: "vendor_concentration",
    content:
      "单一供应商支出占比超过 50% 需评估供应集中风险与关联交易合规性，必要时要求补充说明。",
  },
  {
    id: "550e8400-e29b-41d4-a716-446655440005",
    category: "general",
    content:
      "财务审计应遵循职责分离原则，确保录入、审批、复核由不同岗位完成，降低舞弊与差错风险。",
  },
] as const;

export type RagDependencies = {
  llm: LLMProvider;
  vectorStore: VectorStore;
};

export type RiskItem =
  | { kind: "issue"; index: number; item: AuditIssue }
  | { kind: "anomaly"; index: number; item: AuditAnomaly };

export type ParsedExplanation = {
  summary: string;
  ruleReference?: string;
  recommendation: string;
};

function isHighSeverity(item: Pick<AuditIssue, "severity">): boolean {
  return item.severity === "high";
}

export function isRagConfigured(): boolean {
  return hasLlmApiKey() && Boolean(process.env.PINECONE_API_KEY?.trim());
}

export function buildRetrievalQuery(item: AuditIssue | AuditAnomaly): string {
  const parts = [
    `风险类型：${item.type}`,
    `严重程度：${item.severity}`,
    `规则说明：${item.reason}`,
  ];

  if (item.metadata && Object.keys(item.metadata).length > 0) {
    parts.push(`关联数据：${JSON.stringify(item.metadata)}`);
  }

  return parts.join("\n");
}

export function assemblePolicyContext(results: SearchResult[]): string {
  if (results.length === 0) {
    return "（未检索到相关政策片段，请依据通用内控原则解释。）";
  }

  return results
    .map((result, index) => {
      const content =
        typeof result.metadata?.content === "string"
          ? result.metadata.content
          : "（无正文）";
      const category =
        typeof result.metadata?.category === "string"
          ? result.metadata.category
          : "general";
      const score = result.score.toFixed(3);

      return `[${index + 1}] 分类：${category} | 相关度：${score}\n${content}`;
    })
    .join("\n\n");
}

export function collectHighRiskItems(
  state: Pick<AuditGraphState, "issues" | "anomalies">,
): RiskItem[] {
  const items: RiskItem[] = [];

  state.issues.forEach((issue, index) => {
    if (isHighSeverity(issue)) {
      items.push({ kind: "issue", index, item: issue });
    }
  });

  state.anomalies.forEach((anomaly, index) => {
    if (isHighSeverity(anomaly)) {
      items.push({ kind: "anomaly", index, item: anomaly });
    }
  });

  return items;
}

function relatedRecords(
  records: AuditRecord[],
  item: AuditIssue | AuditAnomaly,
): AuditRecord[] {
  const metadata = item.metadata ?? {};
  const indices = new Set<number>();

  if (typeof metadata.recordIndex === "number") {
    indices.add(metadata.recordIndex);
  }

  if (Array.isArray(metadata.recordIndices)) {
    for (const value of metadata.recordIndices) {
      if (typeof value === "number") {
        indices.add(value);
      }
    }
  }

  return [...indices]
    .sort((a, b) => a - b)
    .flatMap((index) => {
      const record = records[index];
      return record ? [record] : [];
    });
}

function formatRecords(records: AuditRecord[]): string {
  if (records.length === 0) {
    return "（无关联明细行）";
  }

  return records
    .map(
      (record) =>
        `- ${record.date} | ${record.type} | ${record.amount} | ${record.vendor} | ${record.invoiceId}`,
    )
    .join("\n");
}

export function buildExplainPrompt(
  riskItem: RiskItem,
  policyContext: string,
  records: AuditRecord[],
): string {
  const { item } = riskItem;
  const related = relatedRecords(records, item);

  return [
    "你是一名财务审计助手。请根据风险事件、业务数据与检索到的政策上下文，用中文给出专业解释。",
    "",
    "## 风险事件",
    `- 类型：${item.type}`,
    `- 严重程度：${item.severity}`,
    `- 系统初判：${item.reason}`,
    "",
    "## 关联业务数据",
    formatRecords(related),
    "",
    "## 检索到的审计政策",
    policyContext,
    "",
    "## 输出要求",
    "仅返回 JSON，不要 markdown 代码块：",
    '{ "summary": "为什么构成风险（2-3句）", "ruleReference": "引用的政策要点", "recommendation": "可执行的整改建议" }',
  ].join("\n");
}

export function parseExplanationResponse(raw: string): ParsedExplanation {
  const trimmed = raw.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);

  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]) as Partial<ParsedExplanation>;
      const summary = parsed.summary?.trim();
      const recommendation = parsed.recommendation?.trim();

      if (summary && recommendation) {
        return {
          summary,
          ruleReference: parsed.ruleReference?.trim() || undefined,
          recommendation,
        };
      }
    } catch {
      // fall through to plain-text fallback
    }
  }

  return {
    summary: trimmed.slice(0, 500),
    recommendation: "请复核相关凭证并补充审批或说明材料。",
  };
}

export async function retrievePolicyContext(
  query: string,
  deps: Pick<RagDependencies, "llm" | "vectorStore">,
  topK = DEFAULT_TOP_K,
): Promise<string> {
  const embedding = await deps.llm.embed(query);
  const results = await deps.vectorStore.search(embedding, topK);
  return assemblePolicyContext(results);
}

function resolveDependencies(deps?: Partial<RagDependencies>): RagDependencies {
  return {
    llm: deps?.llm ?? createLLMProvider(),
    vectorStore: deps?.vectorStore ?? createVectorStore(),
  };
}

function enrichIssue(
  issue: AuditIssue,
  explanation: ParsedExplanation,
): AuditIssue {
  return {
    ...issue,
    reason: explanation.summary,
    metadata: {
      ...issue.metadata,
      originalReason: issue.reason,
      ruleReference: explanation.ruleReference,
      recommendation: explanation.recommendation,
      llmExplained: true,
    },
  };
}

function enrichAnomaly(
  anomaly: AuditAnomaly,
  explanation: ParsedExplanation,
): AuditAnomaly {
  return {
    ...anomaly,
    reason: explanation.summary,
    metadata: {
      ...anomaly.metadata,
      originalReason: anomaly.reason,
      ruleReference: explanation.ruleReference,
      recommendation: explanation.recommendation,
      llmExplained: true,
    },
  };
}

export async function explainRiskItem(
  riskItem: RiskItem,
  state: Pick<AuditGraphState, "records">,
  deps: RagDependencies,
): Promise<{ explanation: IssueExplanation; parsed: ParsedExplanation }> {
  const query = buildRetrievalQuery(riskItem.item);
  const policyContext = await retrievePolicyContext(query, deps);
  const prompt = buildExplainPrompt(riskItem, policyContext, state.records);
  const raw = await deps.llm.chat(prompt);
  const parsed = parseExplanationResponse(raw);

  return {
    parsed,
    explanation: {
      issueId: `${riskItem.kind}-${riskItem.index}`,
      summary: parsed.summary,
      ruleReference: parsed.ruleReference,
      recommendation: parsed.recommendation,
    },
  };
}

export async function runRagExplain(
  state: Pick<AuditGraphState, "issues" | "anomalies" | "records">,
  deps?: Partial<RagDependencies>,
): Promise<{
  issues: AuditIssue[];
  anomalies: AuditAnomaly[];
  explanations: IssueExplanation[];
}> {
  const highRiskItems = collectHighRiskItems(state);

  if (highRiskItems.length === 0) {
    return {
      issues: state.issues,
      anomalies: state.anomalies,
      explanations: [],
    };
  }

  let resolved: RagDependencies;
  try {
    resolved = resolveDependencies(deps);
  } catch (error) {
    if (
      error instanceof AIProviderError ||
      error instanceof VectorStoreError
    ) {
      return {
        issues: state.issues,
        anomalies: state.anomalies,
        explanations: [],
      };
    }
    throw error;
  }

  const issues = [...state.issues];
  const anomalies = [...state.anomalies];
  const explanations: IssueExplanation[] = [];

  for (const riskItem of highRiskItems) {
    try {
      const { explanation, parsed } = await explainRiskItem(
        riskItem,
        state,
        resolved,
      );
      explanations.push(explanation);

      if (riskItem.kind === "issue") {
        issues[riskItem.index] = enrichIssue(riskItem.item, parsed);
      } else {
        anomalies[riskItem.index] = enrichAnomaly(riskItem.item, parsed);
      }
    } catch {
      // 单条失败不影响其余高风险项与流水线
      continue;
    }
  }

  return { issues, anomalies, explanations };
}

export function categoryForIssueType(type: IssueType): string {
  return type;
}
