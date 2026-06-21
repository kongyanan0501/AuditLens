import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  AIProviderError,
  createLLMProvider,
  resetLLMProviderCache,
} from "@/lib/ai-provider";
import {
  createVectorStore,
  resetVectorStoreCache,
  VectorStoreError,
} from "@/lib/pinecone";

const ENV_KEYS = [
  "AI_PROVIDER",
  "OPENAI_API_KEY",
  "PINECONE_API_KEY",
] as const;

type EnvKey = (typeof ENV_KEYS)[number];

const originalEnv = new Map<EnvKey, string | undefined>();

for (const key of ENV_KEYS) {
  originalEnv.set(key, process.env[key]);
}

function setEnv(key: EnvKey, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
    return;
  }
  process.env[key] = value;
}

function restoreEnv(): void {
  for (const key of ENV_KEYS) {
    setEnv(key, originalEnv.get(key));
  }
  resetLLMProviderCache();
  resetVectorStoreCache();
}

afterEach(() => {
  restoreEnv();
});

describe("AI provider factory", () => {
  it("throws AIProviderError when OPENAI_API_KEY is missing", () => {
    setEnv("AI_PROVIDER", "openai");
    setEnv("OPENAI_API_KEY", undefined);

    assert.throws(
      () => createLLMProvider("openai"),
      (error: unknown) => {
        assert.ok(error instanceof AIProviderError);
        assert.equal(error.code, "AI_MISSING_API_KEY");
        assert.match(error.message, /OPENAI_API_KEY/);
        return true;
      },
    );
  });

  it("throws AIProviderError for unknown AI_PROVIDER", () => {
    setEnv("AI_PROVIDER", "unknown-vendor");

    assert.throws(
      () => createLLMProvider(),
      (error: unknown) => {
        assert.ok(error instanceof AIProviderError);
        assert.equal(error.code, "AI_PROVIDER_UNKNOWN");
        return true;
      },
    );
  });

  it("returns DeepSeek placeholder without API key", async () => {
    setEnv("AI_PROVIDER", "deepseek");
    setEnv("OPENAI_API_KEY", undefined);

    const provider = createLLMProvider("deepseek");
    await assert.rejects(
      () => provider.chat("ping"),
      (error: unknown) => {
        assert.ok(error instanceof AIProviderError);
        assert.equal(error.code, "AI_PROVIDER_NOT_IMPLEMENTED");
        return true;
      },
    );
  });
});

describe("Vector store factory", () => {
  it("throws VectorStoreError when PINECONE_API_KEY is missing", () => {
    setEnv("PINECONE_API_KEY", undefined);

    assert.throws(
      () => createVectorStore(),
      (error: unknown) => {
        assert.ok(error instanceof VectorStoreError);
        assert.equal(error.code, "VECTOR_MISSING_API_KEY");
        assert.match(error.message, /PINECONE_API_KEY/);
        return true;
      },
    );
  });
});
