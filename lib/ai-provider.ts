import OpenAI from "openai";

export type AIProviderName = "openai" | "deepseek";

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

class OpenAIProvider implements LLMProvider {
  private readonly client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async chat(input: string): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: OPENAI_CHAT_MODEL,
      messages: [{ role: "user", content: input }],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new AIProviderError("OpenAI chat returned empty content", "AI_CHAT_EMPTY");
    }

    return content;
  }

  async embed(input: string): Promise<number[]> {
    const response = await this.client.embeddings.create({
      model: OPENAI_EMBED_MODEL,
      input,
    });

    const embedding = response.data[0]?.embedding;
    if (!embedding?.length) {
      throw new AIProviderError("OpenAI embed returned empty vector", "AI_EMBED_EMPTY");
    }

    return embedding;
  }
}

/** Placeholder — swap in DeepSeek-compatible client in a future phase. */
class DeepSeekProvider implements LLMProvider {
  async chat(): Promise<string> {
    throw new AIProviderError(
      "DeepSeekProvider is not implemented yet. Set AI_PROVIDER=openai.",
      "AI_PROVIDER_NOT_IMPLEMENTED",
    );
  }

  async embed(): Promise<number[]> {
    throw new AIProviderError(
      "DeepSeekProvider is not implemented yet. Set AI_PROVIDER=openai.",
      "AI_PROVIDER_NOT_IMPLEMENTED",
    );
  }
}

function resolveProviderName(): AIProviderName {
  const raw = process.env.AI_PROVIDER?.trim().toLowerCase() || "openai";

  if (raw === "openai" || raw === "deepseek") {
    return raw;
  }

  throw new AIProviderError(
    `Unknown AI_PROVIDER "${raw}". Expected "openai" or "deepseek".`,
    "AI_PROVIDER_UNKNOWN",
  );
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
      return new OpenAIProvider(apiKey);
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
