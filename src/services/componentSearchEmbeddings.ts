import { Dexie, type EntityTable } from "dexie";

import {
  type IndexEntry,
  indexEntryToLexicalMatch,
  type LexicalMatch,
} from "@/services/componentSearchIndex";
import { isRecord } from "@/utils/typeGuards";

const COMPONENT_SEARCH_EMBEDDING_MODEL = "text-embedding-3-small";
const DB_NAME = "tangle_component_search_embeddings";
const CACHE_SCHEMA_VERSION = 1;
// The embeddings endpoint caps a single request at 2048 inputs (plus a token
// budget), so batch well under that — otherwise a large cold-cache library
// sends the whole index in one request and 400s, silently disabling the layer.
const EMBEDDING_BATCH_SIZE = 256;
const CACHE_MAX_ENTRIES = 2_000;
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1_000;

interface ComponentSearchEmbeddingCacheEntry {
  cacheKey: string;
  embeddingModel: string;
  textHash: string;
  // Stored alongside the hash so a 32-bit-hash collision is caught as a cache
  // miss: a matching key must agree on both the hash and the text length.
  textLength: number;
  embedding: number[];
  updatedAt: number;
}

const componentSearchEmbeddingDb = new Dexie(DB_NAME) as Dexie & {
  embeddings: EntityTable<ComponentSearchEmbeddingCacheEntry, "cacheKey">;
};

componentSearchEmbeddingDb.version(1).stores({
  embeddings: "cacheKey, embeddingModel, textHash, updatedAt",
});

interface EmbeddingOptions {
  apiBase: string;
  apiKey: string;
  signal?: AbortSignal;
}

interface RankOptions {
  limit: number;
}

function hashText(text: string): string {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

function cacheKey(text: string): string {
  return `${CACHE_SCHEMA_VERSION}:${COMPONENT_SEARCH_EMBEDDING_MODEL}:${hashText(text)}`;
}

function stringifyEmbeddingField(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (value === null || value === undefined) return "";
  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
}

function isNumberArray(value: unknown): value is number[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "number")
  );
}

function readEmbeddingResponse(
  payload: unknown,
  expectedCount: number,
): number[][] {
  if (!isRecord(payload) || !Array.isArray(payload.data)) return [];

  const rows = payload.data
    .map((row, fallbackIndex) => {
      if (!isRecord(row) || !isNumberArray(row.embedding)) return null;
      const index = typeof row.index === "number" ? row.index : fallbackIndex;
      return { index, embedding: row.embedding };
    })
    .filter(
      (row): row is { index: number; embedding: number[] } => row !== null,
    )
    .sort((a, b) => a.index - b.index);

  if (rows.length !== expectedCount) return [];
  return rows.map((row) => row.embedding);
}

async function fetchEmbeddings(
  texts: string[],
  options: EmbeddingOptions,
): Promise<number[][]> {
  const base = options.apiBase.trim().replace(/\/+$/, "");
  if (!base) return [];

  const response = await fetch(`${base}/embeddings`, {
    method: "POST",
    signal: options.signal,
    headers: {
      "content-type": "application/json",
      ...(options.apiKey.trim()
        ? { authorization: `Bearer ${options.apiKey.trim()}` }
        : {}),
    },
    body: JSON.stringify({
      model: COMPONENT_SEARCH_EMBEDDING_MODEL,
      input: texts,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Embeddings API returned ${response.status}: ${detail.slice(0, 200) || response.statusText}`,
    );
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error("Embeddings API returned a non-JSON response");
  }

  const embeddings = readEmbeddingResponse(payload, texts.length);
  if (embeddings.length === 0) {
    throw new Error("Embeddings API returned no usable embeddings");
  }
  return embeddings;
}

async function embedTextsWithCache(
  texts: string[],
  options: EmbeddingOptions,
): Promise<Map<string, number[]>> {
  const uniqueTexts = [
    ...new Set(texts.map((text) => text.trim()).filter(Boolean)),
  ];
  const keys = uniqueTexts.map(cacheKey);
  const cachedRows = await componentSearchEmbeddingDb.embeddings.bulkGet(keys);
  const now = Date.now();
  const expiresBefore = now - CACHE_TTL_MS;

  const result = new Map<string, number[]>();
  const missingTexts: string[] = [];
  for (let i = 0; i < uniqueTexts.length; i++) {
    const cached = cachedRows[i];
    if (
      cached &&
      cached.embeddingModel === COMPONENT_SEARCH_EMBEDDING_MODEL &&
      cached.textHash === hashText(uniqueTexts[i]) &&
      cached.textLength === uniqueTexts[i].length &&
      cached.updatedAt >= expiresBefore
    ) {
      result.set(uniqueTexts[i], cached.embedding);
    } else {
      missingTexts.push(uniqueTexts[i]);
    }
  }

  if (missingTexts.length === 0) return result;

  // Batch the cache-missing texts: a single request over the whole index can
  // exceed the embeddings endpoint's input/token limits and 400.
  const embeddings: number[][] = [];
  for (
    let start = 0;
    start < missingTexts.length;
    start += EMBEDDING_BATCH_SIZE
  ) {
    const batch = missingTexts.slice(start, start + EMBEDDING_BATCH_SIZE);
    embeddings.push(...(await fetchEmbeddings(batch, options)));
  }

  try {
    await componentSearchEmbeddingDb.embeddings.bulkPut(
      missingTexts.map((text, index) => ({
        cacheKey: cacheKey(text),
        embeddingModel: COMPONENT_SEARCH_EMBEDDING_MODEL,
        textHash: hashText(text),
        textLength: text.length,
        embedding: embeddings[index],
        updatedAt: now,
      })),
    );
    await pruneEmbeddingCache(now);
  } catch {
    // Persisting to IndexedDB failed (e.g. QuotaExceededError). The embeddings
    // are still returned below — only the cache write is skipped — so search
    // degrades to "recompute next time" rather than silently returning nothing.
  }
  for (let i = 0; i < missingTexts.length; i++) {
    result.set(missingTexts[i], embeddings[i]);
  }

  return result;
}

async function pruneEmbeddingCache(now: number): Promise<void> {
  const expiresBefore = now - CACHE_TTL_MS;
  await componentSearchEmbeddingDb.embeddings
    .where("updatedAt")
    .below(expiresBefore)
    .delete();

  const count = await componentSearchEmbeddingDb.embeddings.count();
  if (count <= CACHE_MAX_ENTRIES) return;

  const staleRows = await componentSearchEmbeddingDb.embeddings
    .orderBy("updatedAt")
    .limit(count - CACHE_MAX_ENTRIES)
    .primaryKeys();
  await componentSearchEmbeddingDb.embeddings.bulkDelete(staleRows);
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dot / denominator;
}

export function buildComponentEmbeddingText(entry: IndexEntry): string {
  const spec = entry.reference.spec;
  const ioParts = [...(spec?.inputs ?? []), ...(spec?.outputs ?? [])].flatMap(
    (ioSpec) => [
      ioSpec.name,
      ioSpec.description,
      stringifyEmbeddingField(ioSpec.type),
    ],
  );

  return [
    entry.name,
    spec?.description,
    ...ioParts,
    entry.source.label,
    entry.reference.published_by,
  ]
    .filter(
      (part): part is string =>
        typeof part === "string" && part.trim().length > 0,
    )
    .join("\n");
}

export async function rankComponentMatchesByEmbeddings(
  index: IndexEntry[],
  query: string,
  options: EmbeddingOptions,
  { limit }: RankOptions,
): Promise<LexicalMatch[]> {
  const trimmedQuery = query.trim();
  if (trimmedQuery.length === 0 || index.length === 0 || limit <= 0) return [];

  const textByDigest = new Map<string, string>();
  const texts = [trimmedQuery];
  for (const entry of index) {
    const text = buildComponentEmbeddingText(entry);
    if (!text) continue;
    textByDigest.set(entry.digest, text);
    texts.push(text);
  }

  const embeddings = await embedTextsWithCache(texts, options);
  const queryEmbedding = embeddings.get(trimmedQuery);
  if (!queryEmbedding) return [];

  return index
    .map((entry) => {
      const text = textByDigest.get(entry.digest);
      const embedding = text ? embeddings.get(text) : undefined;
      return {
        entry,
        score: embedding ? cosineSimilarity(queryEmbedding, embedding) : 0,
      };
    })
    .filter((item) => item.score > 0)
    .sort(
      (a, b) => b.score - a.score || a.entry.name.localeCompare(b.entry.name),
    )
    .slice(0, limit)
    .map((item) => indexEntryToLexicalMatch(item.entry));
}

export async function clearComponentSearchEmbeddingCache(): Promise<void> {
  await componentSearchEmbeddingDb.embeddings.clear();
}
