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

/** 制度知识库种子（报销 / 授权 / 采购各 ≥2 条）— 与 scripts/seed-knowledge-base.ts 共享 */
export const KNOWLEDGE_SEED_ENTRIES = [
  {
    id: "550e8400-e29b-41d4-a716-446655440001",
    category: "duplicate",
    policyName: "费用报销管理办法",
    clauseId: "第12条",
    content:
      "同一发票号码（invoiceId）不得重复入账或重复报销。发现重复报销的，财务应拒绝支付并追溯已付款项；情节严重的按虚增成本或重复付款风险移交内审核查。",
  },
  {
    id: "550e8400-e29b-41d4-a716-446655440006",
    category: "approval",
    policyName: "费用报销管理办法",
    clauseId: "第6条",
    content:
      "报销单据须附合法有效发票、业务说明及部门负责人签核；无票或要素不全的报销申请不得入账。差旅、招待等费用须符合公司标准并保留行程或招待对象记录。",
  },
  {
    id: "550e8400-e29b-41d4-a716-446655440002",
    category: "approval",
    policyName: "财务授权与审批制度",
    clauseId: "第8条",
    content:
      "达到公司设定必审金额门槛的支出事项，须经授权审批人签字或系统审批后方可入账付款。缺少有效审批的支出记录视为内控缺陷，不得作为合规付款依据。",
  },
  {
    id: "550e8400-e29b-41d4-a716-446655440007",
    category: "approval",
    policyName: "财务授权与审批制度",
    clauseId: "第4条",
    content:
      "授权实行分级管理：普通支出、大额资金与特殊事项分别对应不同审批层级。越权审批或代签无效；系统中审批人字段须与授权矩阵一致并可追溯。",
  },
  {
    id: "550e8400-e29b-41d4-a716-446655440003",
    category: "anomaly",
    policyName: "大额资金与异常支出监控细则",
    clauseId: "第5.2款",
    content:
      "单笔支出金额超过同期样本均值达到公司配置倍数的，应触发二级审批并附异常说明。大额异常波动可能暗示录入错误、拆单规避或潜在舞弊，须留存复核底稿。",
  },
  {
    id: "550e8400-e29b-41d4-a716-446655440004",
    category: "vendor_concentration",
    policyName: "采购与供应商管理办法",
    clauseId: "第15条",
    content:
      "单一供应商在统计期间支出占比超过公司配置阈值时，业务与采购须评估供应集中风险、关联交易与替代方案，并形成书面说明提交内控复核。",
  },
  {
    id: "550e8400-e29b-41d4-a716-446655440008",
    category: "vendor_concentration",
    policyName: "采购与供应商管理办法",
    clauseId: "第9条",
    content:
      "供应商准入须完成资质核验与比价或招标程序；严禁未入库供应商直接结算。关联方供应商须额外披露并经合规复核后方可合作。",
  },
  {
    id: "550e8400-e29b-41d4-a716-446655440005",
    category: "general",
    policyName: "内部控制基本规范实施细则",
    clauseId: "第3条",
    content:
      "财务相关岗位须遵循职责分离：录入、审批、复核应由不同人员完成，禁止一人包办全流程，以降低舞弊与差错风险。",
  },
] as const;

/** Canonical citation: 《制度名》条款号 */
export function formatPolicyCitation(
  policyName: string,
  clauseId: string,
): string {
  return `《${policyName}》${clauseId}`;
}

export function citationFromSearchHit(
  result: SearchResult | undefined,
): string | undefined {
  if (!result?.metadata) return undefined;
  const policyName =
    typeof result.metadata.policyName === "string"
      ? result.metadata.policyName
      : undefined;
  const clauseId =
    typeof result.metadata.clauseId === "string"
      ? result.metadata.clauseId
      : undefined;
  if (policyName && clauseId) {
    return formatPolicyCitation(policyName, clauseId);
  }
  return undefined;
}

export function formatKnowledgeSeedText(entry: {
  policyName: string;
  clauseId: string;
  content: string;
}): string {
  return `【${formatPolicyCitation(entry.policyName, entry.clauseId)}】${entry.content}`;
}

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
      const policyName =
        typeof result.metadata?.policyName === "string"
          ? result.metadata.policyName
          : undefined;
      const clauseId =
        typeof result.metadata?.clauseId === "string"
          ? result.metadata.clauseId
          : undefined;
      const score = result.score.toFixed(3);
      const citation =
        policyName && clauseId
          ? formatPolicyCitation(policyName, clauseId)
          : policyName || "未标注条款";

      return `[${index + 1}] ${citation} | 分类：${category} | 相关度：${score}\n${content}`;
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
    '{ "summary": "为什么构成风险（2-3句）", "ruleReference": "须引用制度名+条款号，如《费用报销管理办法》第12条", "recommendation": "可执行的整改建议" }',
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

export async function retrievePolicyHits(
  query: string,
  deps: Pick<RagDependencies, "llm" | "vectorStore">,
  topK = DEFAULT_TOP_K,
): Promise<SearchResult[]> {
  const embedding = await deps.llm.embed(query);
  return deps.vectorStore.search(embedding, topK);
}

export async function retrievePolicyContext(
  query: string,
  deps: Pick<RagDependencies, "llm" | "vectorStore">,
  topK = DEFAULT_TOP_K,
): Promise<string> {
  const results = await retrievePolicyHits(query, deps, topK);
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
      aiExplanationText: explanation.summary,
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
      aiExplanationText: explanation.summary,
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
  const hits = await retrievePolicyHits(query, deps);
  const policyContext = assemblePolicyContext(hits);
  const prompt = buildExplainPrompt(riskItem, policyContext, state.records);
  const raw = await deps.llm.chat(prompt);
  const parsed = parseExplanationResponse(raw);
  const fallbackCitation = citationFromSearchHit(hits[0]);
  const ruleReference =
    parsed.ruleReference && parsed.ruleReference.includes("《")
      ? parsed.ruleReference
      : fallbackCitation ?? parsed.ruleReference;

  return {
    parsed: { ...parsed, ruleReference },
    explanation: {
      issueId: `${riskItem.kind}-${riskItem.index}`,
      summary: parsed.summary,
      ruleReference,
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
