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
import { KNOWLEDGE_SEED_ENTRIES } from "../server/rag";

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
    let embedding: number[];

    try {
      embedding = await llm.embed(entry.content);
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
            content: entry.content,
            category: entry.category,
          },
        },
      ]);
    } catch (error) {
      throw new Error(formatSeedError("Pinecone upsert", entry.id, error));
    }

    const { error } = await supabase.from("knowledge_base").upsert(
      {
        id: entry.id,
        content: entry.content,
        category: entry.category,
        embedding: `[${embedding.join(",")}]`,
      },
      { onConflict: "id" },
    );

    if (error) {
      throw new Error(
        formatSeedError("Supabase upsert", entry.id, new Error(error.message)),
      );
    }

    console.log(`  ✓ ${entry.id} (${entry.category})`);
  }

  console.log("Knowledge base seed complete.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
