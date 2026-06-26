import "fake-indexeddb/auto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildSearchIndex,
  type ComponentSearchSource,
  type SourcedReference,
} from "@/services/componentSearchIndex";
import type { ComponentReference } from "@/utils/componentSpec";
import { isRecord } from "@/utils/typeGuards";

import {
  buildComponentEmbeddingText,
  clearComponentSearchEmbeddingCache,
  rankComponentMatchesByEmbeddings,
} from "./componentSearchEmbeddings";

const STANDARD: ComponentSearchSource = {
  kind: "standard",
  label: "Standard",
  id: "standard",
};

const OPTIONS = {
  apiBase: "https://api.example.com/v1",
  apiKey: "sk-test",
};

function makeSourced(reference: ComponentReference): SourcedReference {
  return { reference, source: STANDARD };
}

function embeddingForText(text: string): number[] {
  if (/spreadsheet|csv|tabular|dataframe/i.test(text)) return [1, 0, 0];
  if (/train|model|classifier/i.test(text)) return [0, 1, 0];
  return [0, 0, 1];
}

function readFetchInput(init: RequestInit | undefined): string[] {
  if (!init || typeof init.body !== "string") {
    throw new Error("Expected fetch body");
  }
  const body: unknown = JSON.parse(init.body);
  if (!isRecord(body) || !Array.isArray(body.input)) {
    throw new Error("Expected embeddings input array");
  }
  return body.input.filter(
    (value): value is string => typeof value === "string",
  );
}

describe("component search embeddings", () => {
  beforeEach(() => {
    global.fetch = vi.fn(
      async (_url: string | URL | Request, init?: RequestInit) => {
        const input = readFetchInput(init);
        return new Response(
          JSON.stringify({
            data: input.map((text, index) => ({
              index,
              embedding: embeddingForText(text),
            })),
          }),
          { status: 200, statusText: "OK" },
        );
      },
    );
  });

  afterEach(async () => {
    await clearComponentSearchEmbeddingCache();
    vi.restoreAllMocks();
  });

  it("builds embedding text from component metadata", () => {
    const index = buildSearchIndex([
      makeSourced({
        digest: "csv",
        published_by: "publisher@example.com",
        spec: {
          name: "load_csv_file",
          description: "Read a CSV file.",
          inputs: [{ name: "path", type: "String", description: "File path" }],
          outputs: [{ name: "table", type: "Dataset" }],
          implementation: { container: { image: "x" } },
        },
      }),
    ]);

    const text = buildComponentEmbeddingText(index[0]);

    expect(text).toContain("load_csv_file");
    expect(text).toContain("Read a CSV file");
    expect(text).toContain("File path");
    expect(text).toContain("Dataset");
    expect(text).toContain("Standard");
    expect(text).toContain("publisher@example.com");
  });

  it("ranks components by cosine similarity", async () => {
    const index = buildSearchIndex([
      makeSourced({
        digest: "train",
        spec: {
          name: "train_model",
          description: "Train a classifier.",
          inputs: [],
          outputs: [],
          implementation: { container: { image: "x" } },
        },
      }),
      makeSourced({
        digest: "csv",
        spec: {
          name: "load_csv_file",
          description: "Read a CSV file into a tabular dataframe.",
          inputs: [],
          outputs: [],
          implementation: { container: { image: "x" } },
        },
      }),
    ]);

    const results = await rankComponentMatchesByEmbeddings(
      index,
      "open a spreadsheet",
      OPTIONS,
      { limit: 2 },
    );

    expect(results[0]?.digest).toBe("csv");
  });

  it("requests cache misses in batches", async () => {
    const index = buildSearchIndex(
      Array.from({ length: 257 }, (_, index) =>
        makeSourced({
          digest: `component-${index}`,
          spec: {
            name: `component_${index}`,
            description: "Read a CSV file into a tabular dataframe.",
            inputs: [],
            outputs: [],
            implementation: { container: { image: "x" } },
          },
        }),
      ),
    );

    await rankComponentMatchesByEmbeddings(
      index,
      "open a spreadsheet",
      OPTIONS,
      {
        limit: 1,
      },
    );

    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it("invalidates a cached component embedding when its text changes", async () => {
    const initialIndex = buildSearchIndex([
      makeSourced({
        digest: "component",
        spec: {
          name: "load_csv_file",
          description: "Read a CSV file into a tabular dataframe.",
          inputs: [],
          outputs: [],
          implementation: { container: { image: "x" } },
        },
      }),
    ]);
    const updatedIndex = buildSearchIndex([
      makeSourced({
        digest: "component",
        spec: {
          name: "load_csv_file",
          description: "Train a classifier.",
          inputs: [],
          outputs: [],
          implementation: { container: { image: "x" } },
        },
      }),
    ]);

    await rankComponentMatchesByEmbeddings(
      initialIndex,
      "open a spreadsheet",
      OPTIONS,
      { limit: 1 },
    );
    await rankComponentMatchesByEmbeddings(
      updatedIndex,
      "open a spreadsheet",
      OPTIONS,
      { limit: 1 },
    );

    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it("caches query and component embeddings in IndexedDB", async () => {
    const index = buildSearchIndex([
      makeSourced({
        digest: "csv",
        spec: {
          name: "load_csv_file",
          description: "Read a CSV file into a tabular dataframe.",
          inputs: [],
          outputs: [],
          implementation: { container: { image: "x" } },
        },
      }),
    ]);

    await rankComponentMatchesByEmbeddings(
      index,
      "open a spreadsheet",
      OPTIONS,
      {
        limit: 1,
      },
    );
    await rankComponentMatchesByEmbeddings(
      index,
      "open a spreadsheet",
      OPTIONS,
      {
        limit: 1,
      },
    );

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
