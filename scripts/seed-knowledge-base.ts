/**
 * Upsert audit policy snippets to Pinecone and Supabase knowledge_base.
 *
 * Usage: npm run seed:kb
 * Requires: PINECONE_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *           + LLM key per AI_PROVIDER (OPENAI_API_KEY or DASHSCOPE_API_KEY)
 *
 * AI_PROVIDER=qwen 时使用阿里云百炼 DashScope（无需 OpenAI）。
 */
import {
  createLLMProvider,
  EXPECTED_EMBED_DIMENSIONS,
  resolveProviderName,
} from "../lib/ai-provider";
import { loadEnvFiles } from "../lib/load-env";
import { createVectorStore } from "../lib/pinecone";
import { createAdminClient } from "../lib/supabase/admin";
import {
  formatKnowledgeSeedText,
  KNOWLEDGE_SEED_ENTRIES,
} from "../server/rag";

loadEnvFiles();

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required in .env.local for seed:kb`);
  }
  return value;
}

function requireLlmEnv(): void {
  const provider = resolveProviderName();
  if (provider === "qwen") {
    requireEnv("DASHSCOPE_API_KEY");
    return;
  }
  if (provider === "openai") {
    requireEnv("OPENAI_API_KEY");
    return;
  }
  throw new Error(
    `[seed:kb] AI_PROVIDER=${provider} 不支持 seed。请设为 openai 或 qwen（或仅配置 DASHSCOPE_API_KEY）。`,
  );
}

function formatSeedError(step: string, entryId: string | undefined, error: unknown): string {
  const detail =
    error instanceof Error ? error.message : String(error);
  const provider = resolveProviderName();
  const lines = [
    `[seed:kb] ${step}${entryId ? ` (${entryId})` : ""} 失败：${detail}`,
  ];

  if (provider === "qwen") {
    if (detail.toLowerCase().includes("connection error")) {
      lines.push(
        "→ 无法连接 DashScope。请检查 DASHSCOPE_API_KEY 与 DASHSCOPE_BASE_URL（默认北京兼容端点）。",
      );
    } else if (detail.includes("InvalidApiKey") || detail.includes("401")) {
      lines.push("→ 请确认 DASHSCOPE_API_KEY 为阿里云百炼控制台的有效 Key。");
    }
  } else if (
    detail.includes("403") ||
    detail.includes("Country, region, or territory not supported")
  ) {
    lines.push(
      "→ OpenAI 在当前地区不可用。请配置 OPENAI_BASE_URL，或改用 AI_PROVIDER=qwen + DASHSCOPE_API_KEY。",
    );
  } else if (detail.toLowerCase().includes("connection error")) {
    lines.push(
      "→ 无法连接 embedding 服务。请检查 OPENAI_BASE_URL、OPENAI_API_KEY 或改用 AI_PROVIDER=qwen。",
    );
  }

  lines.push(
    `→ Pinecone index：${process.env.PINECONE_INDEX?.trim() || "auditlens"}（须 ${EXPECTED_EMBED_DIMENSIONS} 维 Dense index）`,
  );

  return lines.join("\n");
}

async function main() {
  requireLlmEnv();
  requireEnv("PINECONE_API_KEY");
  requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  const provider = resolveProviderName();
  const llm = createLLMProvider();
  const vectorStore = createVectorStore();
  const supabase = createAdminClient();
  const indexName = process.env.PINECONE_INDEX?.trim() || "auditlens";

  console.log(`Seeding ${KNOWLEDGE_SEED_ENTRIES.length} knowledge entries...`);
  console.log(`AI provider: ${provider}`);
  console.log(`Pinecone index: ${indexName}`);

  for (const entry of KNOWLEDGE_SEED_ENTRIES) {
    const text = formatKnowledgeSeedText(entry);
    let embedding: number[];

    try {
      embedding = await llm.embed(text);
    } catch (error) {
      throw new Error(formatSeedError("embedding", entry.id, error));
    }

    if (embedding.length !== EXPECTED_EMBED_DIMENSIONS) {
      throw new Error(
        `[seed:kb] embedding 维度为 ${embedding.length}，Pinecone index 须为 ${EXPECTED_EMBED_DIMENSIONS}（Qwen 默认 text-embedding-v2；v3/v4 请设 QWEN_EMBED_DIMENSIONS=1536）`,
      );
    }

    try {
      await vectorStore.upsert([
        {
          id: entry.id,
          values: embedding,
          metadata: {
            content: text,
            category: entry.category,
            policyName: entry.policyName,
            clauseId: entry.clauseId,
          },
        },
      ]);
    } catch (error) {
      throw new Error(formatSeedError("Pinecone upsert", entry.id, error));
    }

    const fullRow = {
      id: entry.id,
      content: text,
      category: entry.category,
      policy_name: entry.policyName,
      clause_id: entry.clauseId,
      embedding: `[${embedding.join(",")}]`,
    };

    let { error } = await supabase
      .from("knowledge_base")
      .upsert(fullRow, { onConflict: "id" });

    // PostgREST schema cache often lags after ALTER COLUMN; content already
    // embeds 【制度 条款】 and Pinecone metadata carries policyName/clauseId.
    if (
      error &&
      (error.message.includes("schema cache") ||
        error.message.includes("clause_id") ||
        error.message.includes("policy_name") ||
        error.code === "PGRST204" ||
        error.code === "PGRST205")
    ) {
      console.warn(
        `  ⚠ Supabase schema cache 未识别 policy_name/clause_id，回退写入基础列（${entry.id}）`,
      );
      console.warn(
        "    请在 SQL Editor 执行: notify pgrst, 'reload schema'; 后可再跑一次补全列",
      );
      ({ error } = await supabase.from("knowledge_base").upsert(
        {
          id: entry.id,
          content: text,
          category: entry.category,
          embedding: `[${embedding.join(",")}]`,
        },
        { onConflict: "id" },
      ));
    }

    if (error) {
      throw new Error(
        formatSeedError("Supabase upsert", entry.id, new Error(error.message)),
      );
    }

    console.log(
      `  ✓ ${entry.policyName} ${entry.clauseId} (${entry.category})`,
    );
  }

  console.log("Knowledge base seed complete.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
