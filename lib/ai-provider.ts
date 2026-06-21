import OpenAI from "openai";

export type AIProviderName = "openai" | "deepseek" | "qwen";

export interface LLMProvider {
  chat(input: string): Promise<string>;
  embed(input: string): Promise<number[]>;
}

export class AIProviderError extends Error {
  readonly code: string;

  constructor(message: string, code = "AI_PROVIDER_CONFIG") {
    super(message);
    this.name = "AIProviderError";
    this.code = code;
  }
}

const OPENAI_CHAT_MODEL =
  process.env.OPENAI_CHAT_MODEL?.trim() || "gpt-4o-mini";
const OPENAI_EMBED_MODEL =
  process.env.OPENAI_EMBED_MODEL?.trim() || "text-embedding-3-small";

const QWEN_CHAT_MODEL = process.env.QWEN_CHAT_MODEL?.trim() || "qwen-plus";
const QWEN_EMBED_MODEL =
  process.env.QWEN_EMBED_MODEL?.trim() || "text-embedding-v2";
const DASHSCOPE_BASE_URL =
  process.env.DASHSCOPE_BASE_URL?.trim() ||
  "https://dashscope.aliyuncs.com/compatible-mode/v1";

/** Pinecone / Supabase knowledge_base 当前固定 1536 维 */
export const EXPECTED_EMBED_DIMENSIONS = 1536;

function parseOptionalInt(raw: string | undefined): number | undefined {
  if (!raw?.trim()) {
    return undefined;
  }
  const value = Number.parseInt(raw.trim(), 10);
  return Number.isFinite(value) ? value : undefined;
}

function embedDimensionsForModel(
  model: string,
  envKey: string,
  fallback?: number,
): number | undefined {
  const explicit = parseOptionalInt(process.env[envKey]);
  if (explicit !== undefined) {
    return explicit;
  }
  if (model.includes("v4") || model.includes("v3")) {
    return fallback ?? EXPECTED_EMBED_DIMENSIONS;
  }
  return undefined;
}

class OpenAICompatibleProvider implements LLMProvider {
  private readonly client: OpenAI;
  private readonly chatModel: string;
  private readonly embedModel: string;
  private readonly embedDimensions?: number;

  constructor(options: {
    apiKey: string;
    baseURL?: string;
    chatModel: string;
    embedModel: string;
    embedDimensions?: number;
  }) {
    this.client = new OpenAI({
      apiKey: options.apiKey,
      ...(options.baseURL ? { baseURL: options.baseURL } : {}),
    });
    this.chatModel = options.chatModel;
    this.embedModel = options.embedModel;
    this.embedDimensions = options.embedDimensions;
  }

  async chat(input: string): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: this.chatModel,
      messages: [{ role: "user", content: input }],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new AIProviderError("Chat returned empty content", "AI_CHAT_EMPTY");
    }

    return content;
  }

  async embed(input: string): Promise<number[]> {
    const response = await this.client.embeddings.create({
      model: this.embedModel,
      input,
      ...(this.embedDimensions !== undefined
        ? { dimensions: this.embedDimensions }
        : {}),
    });

    const embedding = response.data[0]?.embedding;
    if (!embedding?.length) {
      throw new AIProviderError("Embed returned empty vector", "AI_EMBED_EMPTY");
    }

    return embedding;
  }
}

/** Placeholder — swap in DeepSeek-compatible client in a future phase. */
class DeepSeekProvider implements LLMProvider {
  async chat(): Promise<string> {
    throw new AIProviderError(
      "DeepSeekProvider is not implemented yet. Set AI_PROVIDER=openai or qwen.",
      "AI_PROVIDER_NOT_IMPLEMENTED",
    );
  }

  async embed(): Promise<number[]> {
    throw new AIProviderError(
      "DeepSeekProvider is not implemented yet. Set AI_PROVIDER=openai or qwen.",
      "AI_PROVIDER_NOT_IMPLEMENTED",
    );
  }
}

export function resolveProviderName(): AIProviderName {
  const raw = process.env.AI_PROVIDER?.trim().toLowerCase();
  if (raw === "openai" || raw === "deepseek" || raw === "qwen") {
    return raw;
  }
  if (raw) {
    throw new AIProviderError(
      `Unknown AI_PROVIDER "${raw}". Expected "openai", "deepseek", or "qwen".`,
      "AI_PROVIDER_UNKNOWN",
    );
  }
  // 未显式设置时：仅有 DashScope Key 则默认 qwen
  if (
    process.env.DASHSCOPE_API_KEY?.trim() &&
    !process.env.OPENAI_API_KEY?.trim()
  ) {
    return "qwen";
  }
  return "openai";
}

export function hasLlmApiKey(
  providerName: AIProviderName = resolveProviderName(),
): boolean {
  switch (providerName) {
    case "openai":
      return Boolean(process.env.OPENAI_API_KEY?.trim());
    case "qwen":
      return Boolean(process.env.DASHSCOPE_API_KEY?.trim());
    case "deepseek":
      return Boolean(process.env.DEEPSEEK_API_KEY?.trim());
    default: {
      const exhaustive: never = providerName;
      return Boolean(exhaustive);
    }
  }
}

export function createLLMProvider(
  providerName: AIProviderName = resolveProviderName(),
): LLMProvider {
  switch (providerName) {
    case "openai": {
      const apiKey = process.env.OPENAI_API_KEY?.trim();
      if (!apiKey) {
        throw new AIProviderError(
          "OPENAI_API_KEY is required when AI_PROVIDER=openai.",
          "AI_MISSING_API_KEY",
        );
      }
      return new OpenAICompatibleProvider({
        apiKey,
        baseURL: process.env.OPENAI_BASE_URL?.trim(),
        chatModel: OPENAI_CHAT_MODEL,
        embedModel: OPENAI_EMBED_MODEL,
      });
    }
    case "qwen": {
      const apiKey = process.env.DASHSCOPE_API_KEY?.trim();
      if (!apiKey) {
        throw new AIProviderError(
          "DASHSCOPE_API_KEY is required when AI_PROVIDER=qwen.",
          "AI_MISSING_API_KEY",
        );
      }
      const embedModel = QWEN_EMBED_MODEL;
      return new OpenAICompatibleProvider({
        apiKey,
        baseURL: DASHSCOPE_BASE_URL,
        chatModel: QWEN_CHAT_MODEL,
        embedModel,
        embedDimensions: embedDimensionsForModel(
          embedModel,
          "QWEN_EMBED_DIMENSIONS",
        ),
      });
    }
    case "deepseek":
      return new DeepSeekProvider();
    default: {
      const exhaustive: never = providerName;
      throw new AIProviderError(
        `Unsupported AI provider: ${String(exhaustive)}`,
        "AI_PROVIDER_UNKNOWN",
      );
    }
  }
}

let cachedProvider: LLMProvider | null = null;

export function getLLMProvider(): LLMProvider {
  if (!cachedProvider) {
    cachedProvider = createLLMProvider();
  }
  return cachedProvider;
}

export function resetLLMProviderCache(): void {
  cachedProvider = null;
}
