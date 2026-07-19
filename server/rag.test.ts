import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { LLMProvider } from "@/lib/ai-provider";
import type { VectorStore } from "@/lib/pinecone";
import {
  assemblePolicyContext,
  buildExplainPrompt,
  buildRetrievalQuery,
  citationFromSearchHit,
  collectHighRiskItems,
  formatPolicyCitation,
  isRagConfigured,
  parseExplanationResponse,
  runRagExplain,
} from "@/server/rag";
import type { AuditAnomaly, AuditIssue } from "@/types/audit";

describe("formatPolicyCitation", () => {
  it("uses book-title marks and clause id", () => {
    assert.equal(
      formatPolicyCitation("费用报销管理办法", "第12条"),
      "《费用报销管理办法》第12条",
    );
  });

  it("citationFromSearchHit reads metadata", () => {
    assert.equal(
      citationFromSearchHit({
        id: "1",
        score: 0.9,
        metadata: { policyName: "采购与供应商管理办法", clauseId: "第15条" },
      }),
      "《采购与供应商管理办法》第15条",
    );
  });
});

describe("buildRetrievalQuery", () => {
  it("includes type, severity, and reason", () => {
    const issue: AuditIssue = {
      type: "duplicate",
      severity: "high",
      reason: "发票号 INV-001 重复出现 2 次",
      metadata: { invoiceId: "INV-001" },
    };

    const query = buildRetrievalQuery(issue);
    assert.match(query, /duplicate/);
    assert.match(query, /high/);
    assert.match(query, /INV-001/);
  });
});

describe("assemblePolicyContext", () => {
  it("formats search hits with policy citation", () => {
    const context = assemblePolicyContext([
      {
        id: "kb-1",
        score: 0.91,
        metadata: {
          category: "duplicate",
          content: "同一 invoiceId 不得重复入账。",
          policyName: "费用报销管理办法",
          clauseId: "第12条",
        },
      },
    ]);

    assert.match(context, /duplicate/);
    assert.match(context, /同一 invoiceId/);
    assert.match(context, /《费用报销管理办法》第12条/);
  });

  it("returns fallback when no hits", () => {
    const context = assemblePolicyContext([]);
    assert.match(context, /未检索到/);
  });
});

describe("parseExplanationResponse", () => {
  it("parses JSON payload", () => {
    const parsed = parseExplanationResponse(
      '{"summary":"存在重复入账风险","ruleReference":"发票唯一性","recommendation":"核对并冲销重复条目"}',
    );

    assert.equal(parsed.summary, "存在重复入账风险");
    assert.equal(parsed.ruleReference, "发票唯一性");
    assert.equal(parsed.recommendation, "核对并冲销重复条目");
  });

  it("falls back when JSON is invalid", () => {
    const parsed = parseExplanationResponse("模型返回纯文本说明");
    assert.equal(parsed.summary, "模型返回纯文本说明");
    assert.ok(parsed.recommendation.length > 0);
  });
});

describe("collectHighRiskItems", () => {
  it("keeps only high severity issues and anomalies", () => {
    const issues: AuditIssue[] = [
      { type: "duplicate", severity: "high", reason: "重复" },
      { type: "approval", severity: "medium", reason: "缺审批" },
    ];
    const anomalies: AuditAnomaly[] = [
      { type: "anomaly", severity: "high", reason: "金额异常" },
      { type: "vendor_concentration", severity: "medium", reason: "集中" },
    ];

    const items = collectHighRiskItems({ issues, anomalies });
    assert.equal(items.length, 2);
    assert.equal(items[0]?.kind, "issue");
    assert.equal(items[1]?.kind, "anomaly");
  });
});

describe("buildExplainPrompt", () => {
  it("includes policy context and related records", () => {
    const prompt = buildExplainPrompt(
      {
        kind: "issue",
        index: 0,
        item: {
          type: "duplicate",
          severity: "high",
          reason: "发票号 INV-001 重复出现 2 次",
          metadata: { recordIndices: [0, 1] },
        },
      },
      "[1] 分类：duplicate\n同一 invoiceId 不得重复入账。",
      [
        {
          date: "2025-01-01",
          type: "expense",
          amount: 100,
          vendor: "甲公司",
          invoiceId: "INV-001",
        },
        {
          date: "2025-01-02",
          type: "expense",
          amount: 100,
          vendor: "甲公司",
          invoiceId: "INV-001",
        },
      ],
    );

    assert.match(prompt, /审计政策/);
    assert.match(prompt, /INV-001/);
    assert.match(prompt, /"summary"/);
  });
});

describe("isRagConfigured", () => {
  it("returns true when qwen and pinecone keys are set", () => {
    const saved = {
      AI_PROVIDER: process.env.AI_PROVIDER,
      DASHSCOPE_API_KEY: process.env.DASHSCOPE_API_KEY,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      PINECONE_API_KEY: process.env.PINECONE_API_KEY,
    };

    try {
      process.env.AI_PROVIDER = "qwen";
      process.env.DASHSCOPE_API_KEY = "test-key";
      delete process.env.OPENAI_API_KEY;
      process.env.PINECONE_API_KEY = "pc-test";

      assert.equal(isRagConfigured(), true);
    } finally {
      for (const [key, value] of Object.entries(saved)) {
        if (value === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      }
    }
  });
});

describe("runRagExplain", () => {
  it("enriches high severity items with LLM output", async () => {
    const llm: LLMProvider = {
      embed: async () => [0.1, 0.2, 0.3],
      chat: async () =>
        JSON.stringify({
          summary: "重复发票可能导致重复付款，属于高风险内控缺陷。",
          ruleReference: "同一 invoiceId 不得重复入账",
          recommendation: "立即核对原始凭证并作废重复条目。",
        }),
    };
    const vectorStore: VectorStore = {
      upsert: async () => {},
      search: async () => [
        {
          id: "550e8400-e29b-41d4-a716-446655440001",
          score: 0.95,
          metadata: {
            category: "duplicate",
            content: "同一 invoiceId 不得重复入账。",
          },
        },
      ],
    };

    const result = await runRagExplain(
      {
        issues: [
          {
            type: "duplicate",
            severity: "high",
            reason: "发票号 INV-001 重复出现 2 次",
          },
          {
            type: "approval",
            severity: "medium",
            reason: "缺少审批人",
          },
        ],
        anomalies: [],
        records: [],
      },
      { llm, vectorStore },
    );

    assert.equal(result.explanations.length, 1);
    assert.match(result.issues[0]?.reason ?? "", /重复发票/);
    assert.equal(
      result.issues[0]?.metadata?.recommendation,
      "立即核对原始凭证并作废重复条目。",
    );
    assert.equal(result.issues[1]?.reason, "缺少审批人");
  });

  it("returns original state when dependencies are unavailable", async () => {
    const savedEnv = {
      AI_PROVIDER: process.env.AI_PROVIDER,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      DASHSCOPE_API_KEY: process.env.DASHSCOPE_API_KEY,
      PINECONE_API_KEY: process.env.PINECONE_API_KEY,
    };

    try {
      process.env.AI_PROVIDER = "openai";
      delete process.env.OPENAI_API_KEY;
      delete process.env.DASHSCOPE_API_KEY;
      delete process.env.PINECONE_API_KEY;

      const issues: AuditIssue[] = [
        { type: "duplicate", severity: "high", reason: "重复" },
      ];
      const result = await runRagExplain({
        issues,
        anomalies: [],
        records: [],
      });

      assert.deepEqual(result.issues, issues);
      assert.equal(result.explanations.length, 0);
    } finally {
      if (savedEnv.AI_PROVIDER === undefined) {
        delete process.env.AI_PROVIDER;
      } else {
        process.env.AI_PROVIDER = savedEnv.AI_PROVIDER;
      }
      if (savedEnv.OPENAI_API_KEY === undefined) {
        delete process.env.OPENAI_API_KEY;
      } else {
        process.env.OPENAI_API_KEY = savedEnv.OPENAI_API_KEY;
      }
      if (savedEnv.DASHSCOPE_API_KEY === undefined) {
        delete process.env.DASHSCOPE_API_KEY;
      } else {
        process.env.DASHSCOPE_API_KEY = savedEnv.DASHSCOPE_API_KEY;
      }
      if (savedEnv.PINECONE_API_KEY === undefined) {
        delete process.env.PINECONE_API_KEY;
      } else {
        process.env.PINECONE_API_KEY = savedEnv.PINECONE_API_KEY;
      }
    }
  });
});
