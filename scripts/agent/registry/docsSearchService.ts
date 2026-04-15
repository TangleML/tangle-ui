/**
 * Semantic search service over the docs vector store.
 * Loaded at server startup and used by the search_docs tool.
 */
import type { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

import { config } from "../config";
import type { DocMetadata } from "./types";
import { getDocumentCount, loadVectorStore } from "./vectorStoreFactory";

let vectorStore: MemoryVectorStore | null = null;

export async function loadDocsSearchService(): Promise<void> {
  if (vectorStore) return;
  vectorStore = await loadVectorStore(
    config.docsVectorStorePath,
    config.embeddingModel,
  );
  console.log(`Docs registry loaded: ${getDocumentCount(vectorStore)} chunks`);
}

export async function searchDocsQuery(query: string, topK = 5) {
  if (!vectorStore) {
    await loadDocsSearchService();
  }

  if (getDocumentCount(vectorStore!) === 0) {
    return [];
  }

  return vectorStore!.similaritySearchWithScore(query, topK);
}

export const searchDocsTool = tool(
  async ({ query, topK }: { query: string; topK?: number }) => {
    const results = await searchDocsQuery(query, topK ?? 5);

    if (results.length === 0) {
      return JSON.stringify({
        results: [],
        message:
          "No docs found. The docs index may be empty — run `pnpm agent:index-docs` first.",
      });
    }

    return JSON.stringify({
      results: results.map(([doc, score]) => {
        const meta = doc.metadata as DocMetadata;
        const content = doc.pageContent;
        return {
          title: meta.title,
          sectionTitle: meta.sectionTitle,
          content:
            content.length > 1500
              ? content.substring(0, 1500) + "\n... (truncated)"
              : content,
          url: meta.url,
          citation: `[${meta.title}](${meta.url})`,
          score: Math.round(score * 1000) / 1000,
        };
      }),
      instruction:
        "IMPORTANT: You MUST include the `url` from the top result(s) in your response as a markdown link. " +
        "Use the `citation` field directly, e.g. 'Learn more: [Title](url)'.",
    });
  },
  {
    name: "search_docs",
    description:
      "Search Tangle documentation by semantic meaning. Returns relevant doc sections with URLs to tangleml.com/docs. " +
      "Use for conceptual questions about Tangle. Each result includes a `url` and `citation` field — " +
      "always include the documentation link in your response.",
    schema: z.object({
      query: z
        .string()
        .describe(
          "Natural language question about Tangle concepts or features",
        ),
      topK: z
        .number()
        .optional()
        .describe("Number of results to return (default 5)"),
    }),
  },
);
