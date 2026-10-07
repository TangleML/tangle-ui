import "fake-indexeddb/auto";

import OpenAI from "openai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { OpenAIProvider } from "../config";
import {
  agentDb,
  type PersistedVectorStore,
  TANGLE_ML_DOCS_VECTORS_KEY,
} from "../idb/agentDb";

const TEST_EMBEDDING_MODEL = "text-embedding-3-small";

const embeddingsCreateMock = vi.fn();

vi.mock("../config", () => ({
  config: { embeddingModel: TEST_EMBEDDING_MODEL },
  requireEmbeddingModel: () => TEST_EMBEDDING_MODEL,
}));

const fakeProvider: OpenAIProvider = {
  openai: {
    embeddings: { create: embeddingsCreateMock },
  } as unknown as OpenAI,
};

const fetchMock = vi.fn();
const originalFetch = globalThis.fetch;

/**
 * Each vector lives on its own basis axis so cosine similarity against
 * any query is just the query's component along that axis. This makes
 * top-K assertions deterministic regardless of how many vectors we add
 * to the fixture.
 */
const FIXTURE_TITLES = [
  "Tasks",
  "Components",
  "Bindings",
  "Pipelines",
  "Inputs",
  "Outputs",
] as const;
const FIXTURE_DIM = FIXTURE_TITLES.length;

function basisVector(index: number): number[] {
  return Array.from({ length: FIXTURE_DIM }, (_, i) => (i === index ? 1 : 0));
}

function makeVector(
  title: string,
  index: number,
): PersistedVectorStore["vectors"][number] {
  const slug = title.toLowerCase();
  return {
    content: `${title} content.`,
    embedding: basisVector(index),
    metadata: {
      id: `${slug}#intro`,
      title,
      sectionTitle: title,
      url: `https://tangleml.com/docs/core-concepts/${slug}`,
      contentHash: `${slug}-1`,
    },
  };
}

/**
 * 6 orthogonal vectors so `topK ?? DEFAULT_TOP_K = 5` is exercised
 * below the fixture size (otherwise the result count is bounded by
 * the store and the default-topK assertion is meaningless).
 */
function makeStore(): PersistedVectorStore {
  return {
    version: 2,
    embeddingModel: TEST_EMBEDDING_MODEL,
    vectors: FIXTURE_TITLES.map((title, i) => makeVector(title, i)),
  };
}

function makeEmptyStore(): PersistedVectorStore {
  return {
    version: 2,
    embeddingModel: TEST_EMBEDDING_MODEL,
    vectors: [],
  };
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  fetchMock.mockReset();
  embeddingsCreateMock.mockReset();
});

afterEach(async () => {
  globalThis.fetch = originalFetch;
  await agentDb.vectors.clear();
  vi.resetModules();
});

describe("executeSearchDocs", () => {
  it("ranks vectors by cosine similarity and returns top-K", async () => {
    fetchMock.mockResolvedValue(jsonResponse(makeStore()));
    // Mostly aligned with Tasks (axis 0), small bias toward Components (axis 1).
    embeddingsCreateMock.mockResolvedValue({
      data: [{ embedding: [0.9, 0.1, 0, 0, 0, 0] }],
    });

    const { executeSearchDocs, DocsVectorStoreCache } =
      await import("./searchDocs");
    const raw = await executeSearchDocs(
      { query: "what is a task?", topK: 2 },
      fakeProvider,
      new DocsVectorStoreCache(),
    );
    const parsed = JSON.parse(raw) as {
      results: Array<{
        title: string;
        url: string;
        citation: string;
        score: number;
      }>;
      instruction?: string;
      error?: string;
    };

    expect(parsed.error).toBeUndefined();
    expect(parsed.results).toHaveLength(2);
    expect(parsed.results[0].title).toBe("Tasks");
    expect(parsed.results[1].title).toBe("Components");
    expect(parsed.results[0].score).toBeGreaterThan(parsed.results[1].score);
    expect(parsed.results[0].citation).toBe(
      "[Tasks](https://tangleml.com/docs/core-concepts/tasks)",
    );
    expect(parsed.instruction).toContain("markdown link");
  });

  it("defaults topK to 5 when omitted", async () => {
    // Fixture has 6 vectors so a 5-cap actually has something to drop.
    fetchMock.mockResolvedValue(jsonResponse(makeStore()));
    embeddingsCreateMock.mockResolvedValue({
      data: [{ embedding: [1, 1, 1, 1, 1, 1] }],
    });

    const { executeSearchDocs, DocsVectorStoreCache } =
      await import("./searchDocs");
    const raw = await executeSearchDocs(
      { query: "anything" },
      fakeProvider,
      new DocsVectorStoreCache(),
    );
    const parsed = JSON.parse(raw) as { results: unknown[] };

    expect(parsed.results).toHaveLength(5);
  });

  it("returns ranked text matches and citations when embeddings are unavailable", async () => {
    const store = makeStore();
    store.vectors[0].content = "Tasks combine inputs and outputs.";
    fetchMock.mockResolvedValue(jsonResponse(store));
    embeddingsCreateMock.mockRejectedValue(new Error("Embeddings unavailable"));

    const { executeSearchDocs, DocsVectorStoreCache } =
      await import("./searchDocs");
    const raw = await executeSearchDocs(
      { query: "TASKS tasks inputs outputs", topK: 2 },
      fakeProvider,
      new DocsVectorStoreCache(),
    );
    const parsed = JSON.parse(raw);

    expect(parsed.error).toBeUndefined();
    expect(parsed.results).toHaveLength(2);
    expect(parsed.results[0]).toMatchObject({
      title: "Tasks",
      score: 1,
      citation: "[Tasks](https://tangleml.com/docs/core-concepts/tasks)",
    });
    expect(parsed.results[1].title).toBe("Inputs");
    expect(parsed.results[1].score).toBeCloseTo(1 / 3, 3);
    expect(parsed.instruction).toContain("markdown link");
  });

  it("omits unrelated documents when the text fallback has no matches", async () => {
    fetchMock.mockResolvedValue(jsonResponse(makeStore()));
    embeddingsCreateMock.mockRejectedValue(new Error("Embeddings unavailable"));

    const { executeSearchDocs, DocsVectorStoreCache } =
      await import("./searchDocs");
    const raw = await executeSearchDocs(
      { query: "unrelated-query" },
      fakeProvider,
      new DocsVectorStoreCache(),
    );
    const parsed = JSON.parse(raw);

    expect(parsed.error).toBeUndefined();
    expect(parsed.results).toEqual([]);
  });

  it("searches docs without requesting unsupported Anthropic embeddings", async () => {
    fetchMock.mockResolvedValue(jsonResponse(makeStore()));
    const provider = {
      openai: new OpenAI({
        baseURL: "https://api.anthropic.com/v1",
        apiKey: "test-key",
        dangerouslyAllowBrowser: true,
      }),
    };
    const { executeSearchDocs, DocsVectorStoreCache } =
      await import("./searchDocs");
    const parsed = JSON.parse(
      await executeSearchDocs(
        { query: "components" },
        provider,
        new DocsVectorStoreCache(),
      ),
    );

    expect(parsed.error).toBeUndefined();
    expect(parsed.results[0].citation).toBe(
      "[Components](https://tangleml.com/docs/core-concepts/components)",
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(embeddingsCreateMock).not.toHaveBeenCalled();
  });

  it("returns the populate-instruction message when the index is empty", async () => {
    fetchMock.mockResolvedValue(jsonResponse(makeEmptyStore()));

    const { executeSearchDocs, DocsVectorStoreCache } =
      await import("./searchDocs");
    const raw = await executeSearchDocs(
      { query: "anything" },
      fakeProvider,
      new DocsVectorStoreCache(),
    );
    const parsed = JSON.parse(raw) as {
      results: unknown[];
      message?: string;
      error?: string;
    };

    expect(parsed.error).toBeUndefined();
    expect(parsed.results).toEqual([]);
    expect(parsed.message).toMatch(/Docs index is empty/);
    // Empty index should short-circuit before we ever embed the query.
    expect(embeddingsCreateMock).not.toHaveBeenCalled();
  });

  it("populates the IDB cache on first call and reuses it on the second", async () => {
    fetchMock.mockResolvedValue(jsonResponse(makeStore()));
    embeddingsCreateMock.mockResolvedValue({
      data: [{ embedding: basisVector(0) }],
    });

    const { executeSearchDocs, DocsVectorStoreCache } =
      await import("./searchDocs");

    await executeSearchDocs(
      { query: "first" },
      fakeProvider,
      new DocsVectorStoreCache(),
    );
    const cachedRow = await agentDb.vectors.get(TANGLE_ML_DOCS_VECTORS_KEY);
    expect(cachedRow?.embeddingModel).toBe(TEST_EMBEDDING_MODEL);
    expect(cachedRow?.payload.vectors).toHaveLength(6);

    await executeSearchDocs(
      { query: "second" },
      fakeProvider,
      new DocsVectorStoreCache(),
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(embeddingsCreateMock).toHaveBeenCalledTimes(2);
  });

  it("returns an error payload when fetch fails", async () => {
    fetchMock.mockResolvedValue(
      new Response("", { status: 500, statusText: "Internal Server Error" }),
    );
    embeddingsCreateMock.mockResolvedValue({
      data: [{ embedding: basisVector(0) }],
    });

    const { executeSearchDocs, DocsVectorStoreCache } =
      await import("./searchDocs");
    const raw = await executeSearchDocs(
      { query: "hello" },
      fakeProvider,
      new DocsVectorStoreCache(),
    );
    const parsed = JSON.parse(raw) as { results: unknown[]; error?: string };

    expect(parsed.results).toEqual([]);
    expect(parsed.error).toContain("500");
  });
});
