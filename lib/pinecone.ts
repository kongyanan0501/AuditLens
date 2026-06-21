import { Pinecone, type RecordMetadata } from "@pinecone-database/pinecone";

import type { SearchResult, VectorRecord } from "@/types/audit";

export interface VectorStore {
  upsert(vectors: VectorRecord[]): Promise<void>;
  search(query: number[], topK?: number): Promise<SearchResult[]>;
}

export class VectorStoreError extends Error {
  readonly code: string;

  constructor(message: string, code = "VECTOR_STORE_CONFIG") {
    super(message);
    this.name = "VectorStoreError";
    this.code = code;
  }
}

const DEFAULT_TOP_K = 5;
const PINECONE_INDEX = process.env.PINECONE_INDEX?.trim() || "auditlens";

class PineconeStore implements VectorStore {
  private readonly index;

  constructor(apiKey: string, indexName: string) {
    const client = new Pinecone({ apiKey });
    this.index = client.index(indexName);
  }

  async upsert(vectors: VectorRecord[]): Promise<void> {
    if (vectors.length === 0) {
      return;
    }

    await this.index.upsert({
      records: vectors.map((vector) => ({
        id: vector.id,
        values: vector.values,
        metadata: vector.metadata as RecordMetadata | undefined,
      })),
    });
  }

  async search(query: number[], topK = DEFAULT_TOP_K): Promise<SearchResult[]> {
    if (query.length === 0) {
      throw new VectorStoreError("Search query vector must not be empty.", "VECTOR_EMPTY_QUERY");
    }

    const response = await this.index.query({
      vector: query,
      topK,
      includeMetadata: true,
    });

    return (response.matches ?? []).flatMap((match) => {
      if (!match.id) {
        return [];
      }

      return [
        {
          id: match.id,
          score: match.score ?? 0,
          metadata: match.metadata as Record<string, unknown> | undefined,
        },
      ];
    });
  }
}

export function createVectorStore(): VectorStore {
  const apiKey = process.env.PINECONE_API_KEY?.trim();
  if (!apiKey) {
    throw new VectorStoreError(
      "PINECONE_API_KEY is required to use the vector store.",
      "VECTOR_MISSING_API_KEY",
    );
  }

  return new PineconeStore(apiKey, PINECONE_INDEX);
}

let cachedStore: VectorStore | null = null;

export function getVectorStore(): VectorStore {
  if (!cachedStore) {
    cachedStore = createVectorStore();
  }
  return cachedStore;
}

export function resetVectorStoreCache(): void {
  cachedStore = null;
}
