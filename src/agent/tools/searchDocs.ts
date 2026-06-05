/**
 * In-browser docs RAG tool.
 *
 * Loads the Tangle docs vector store from `/agent-index/docs-vector-store.json`
 * on first use (cached in IndexedDB via `agentDb.vectors` for subsequent
 * loads, and in-memory per `createSearchDocsTool` call for the lifetime of
 * the tool), embeds the user's query through the configured OpenAI proxy,
 * ranks all stored vectors by cosine similarity, and returns the top-K
 * hits formatted for the model to cite back.
 *
 * Replaces the PoC's `search_docs` backend call — see PR 4 of
 * `.cursor/plans/ai_assistant_beta_rollout_e309f590.plan.md` for the
 * reasoning behind moving this in-browser.
 */
import { tool } from "@openai/agents";
import { z } from "zod";

import { BASE_URL } from "@/utils/constants";

import { type OpenAIProvider, requireEmbeddingModel } from "../config";
import {
  agentDb,
  type PersistedVector,
  type PersistedVectorStore,
  TANGLE_ML_DOCS_VECTORS_KEY,
} from "../idb/agentDb";

const DOCS_VECTOR_STORE_URL = `${BASE_URL.replace(/\/$/, "")}/agent-index/docs-vector-store.json`;

const EXPECTED_STORE_VERSION = 2;

const MAX_CONTENT_CHARS = 1500;
const DEFAULT_TOP_K = 5;

interface DocMetadata {
  id: string;
  title: string;
  sectionTitle: string;
  url: string;
}

interface SearchDocsHit {
  title: string;
  sectionTitle: string;
  content: string;
  url: string;
  citation: string;
  score: number;
}

interface SearchDocsResponse {
  results: SearchDocsHit[];
  instruction?: string;
  message?: string;
  error?: string;
}

const persistedVectorStoreSchema = z.object({
  version: z.number(),
  embeddingModel: z.string(),
  vectors: z.array(
    z.object({
      content: z.string(),
      embedding: z.array(z.number()),
      metadata: z.record(z.string(), z.unknown()),
    }),
  ),
});

/**
 * In-memory cache for the docs vector store. Owned per tool instance
 * (created in `createSearchDocsTool`); IDB still serves as the
 * cross-session persistence layer via `agentDb.vectors`.
 *
 * Loads the docs vector store, preferring the IDB cache. Concurrent
 * callers share one in-flight Promise so we never run two parallel
 * fetches. The cache is invalidated when the configured embedding
 * model no longer matches the persisted one — otherwise queries
 * embedded with model A would be compared against vectors built by
 * model B and ranking would be meaningless.
 */
export class DocsVectorStoreCache {
  #cached: PersistedVectorStore | null = null;
  #inflight: Promise<PersistedVectorStore> | null = null;

  async load(): Promise<PersistedVectorStore> {
    if (this.#cached) return this.#cached;
    if (this.#inflight) return this.#inflight;

    this.#inflight = this.#fetchAndPersist();
    try {
      this.#cached = await this.#inflight;
      return this.#cached;
    } finally {
      this.#inflight = null;
    }
  }

  async #fetchAndPersist(): Promise<PersistedVectorStore> {
    const expectedModel = requireEmbeddingModel();
    const row = await agentDb.vectors.get(TANGLE_ML_DOCS_VECTORS_KEY);
    if (
      row &&
      row.embeddingModel === expectedModel &&
      row.version === EXPECTED_STORE_VERSION
    ) {
      return row.payload;
    }

    const response = await fetch(DOCS_VECTOR_STORE_URL);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch docs vector store (${response.status} ${response.statusText})`,
      );
    }
    const payload = persistedVectorStoreSchema.parse(await response.json());
    await agentDb.vectors.put({
      key: TANGLE_ML_DOCS_VECTORS_KEY,
      embeddingModel: payload.embeddingModel,
      version: payload.version,
      payload,
    });
    return payload;
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(
      `Vector length mismatch: query=${a.length}, doc=${b.length}. ` +
        `The docs index was likely built with a different embedding model than ${requireEmbeddingModel()}.`,
    );
  }
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) return 0;
  return dot / denom;
}

function rankByCosine(
  vectors: PersistedVector[],
  query: number[],
  topK: number,
): Array<{ vector: PersistedVector; score: number }> {
  const scored = vectors.map((vector) => ({
    vector,
    score: cosineSimilarity(query, vector.embedding),
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}

function truncate(content: string): string {
  if (content.length <= MAX_CONTENT_CHARS) return content;
  return content.substring(0, MAX_CONTENT_CHARS) + "\n... (truncated)";
}

function isDocMetadata(
  value: Record<string, unknown>,
): value is DocMetadata & Record<string, unknown> {
  return (
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.sectionTitle === "string" &&
    typeof value.url === "string"
  );
}

async function embedQuery(
  query: string,
  provider: OpenAIProvider,
): Promise<number[]> {
  const response = await provider.openai.embeddings.create({
    model: requireEmbeddingModel(),
    input: query,
  });
  const first = response.data[0];
  if (!first) {
    throw new Error("Embeddings API returned no data");
  }
  return first.embedding;
}

export async function executeSearchDocs(
  params: {
    query: string;
    topK?: number | null;
  },
  provider: OpenAIProvider,
  cache: DocsVectorStoreCache,
): Promise<string> {
  const { query } = params;
  const topK = params.topK ?? DEFAULT_TOP_K;

  try {
    const store = await cache.load();
    if (store.vectors.length === 0) {
      const empty: SearchDocsResponse = {
        results: [],
        message: "Docs index is empty. Contact the Tangle team to rebuild it.",
      };
      return JSON.stringify(empty);
    }

    const queryVec = await embedQuery(query, provider);
    const ranked = rankByCosine(store.vectors, queryVec, topK);

    const hits: SearchDocsHit[] = [];
    for (const { vector, score } of ranked) {
      if (!isDocMetadata(vector.metadata)) continue;
      const meta = vector.metadata;
      hits.push({
        title: meta.title,
        sectionTitle: meta.sectionTitle,
        content: truncate(vector.content),
        url: meta.url,
        citation: `[${meta.title}](${meta.url})`,
        score: Math.round(score * 1000) / 1000,
      });
    }

    const response: SearchDocsResponse = {
      results: hits,
      instruction:
        "IMPORTANT: You MUST include the `url` from the top result(s) in your response as a markdown link. " +
        "Use the `citation` field directly, e.g. 'Learn more: [Title](url)'.",
    };
    return JSON.stringify(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const response: SearchDocsResponse = { results: [], error: message };
    return JSON.stringify(response);
  }
}

export function createSearchDocsTool(provider: OpenAIProvider) {
  const cache = new DocsVectorStoreCache();
  return tool({
    name: "search_docs",
    description:
      "Search Tangle documentation by semantic meaning. Returns relevant doc sections with URLs to tangleml.com/docs. " +
      "Use for conceptual questions about Tangle. Each result includes a `url` and `citation` field — " +
      "always include the documentation link in your response.",
    parameters: z.object({
      query: z
        .string()
        .describe(
          "Natural language question about Tangle concepts or features",
        ),
      topK: z
        .number()
        .int()
        .min(1)
        .max(20)
        .nullable()
        .optional()
        .describe("Number of results to return (default 5, max 20)"),
    }),
    execute: (params) => executeSearchDocs(params, provider, cache),
  });
}
