/**
 * In-process semantic search service over the component vector store.
 * Loaded at server startup and used by the search_components tool.
 */
import type { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

import { config } from "../config";
import type { AgentSession } from "../session";
import { recordComponentReference } from "../session";
import type { ComponentMetadata } from "./types";
import { getDocumentCount, loadVectorStore } from "./vectorStoreFactory";

let vectorStore: MemoryVectorStore | null = null;

export async function loadSearchService(): Promise<void> {
  if (vectorStore) return;
  vectorStore = await loadVectorStore(
    config.vectorStorePath,
    config.embeddingModel,
  );
  console.log(
    `Component registry loaded: ${getDocumentCount(vectorStore)} components`,
  );
}

export async function searchComponents(query: string, topK = 5) {
  if (!vectorStore) {
    await loadSearchService();
  }

  if (getDocumentCount(vectorStore!) === 0) {
    return [];
  }

  return vectorStore!.similaritySearchWithScore(query, topK);
}

export function createSearchComponentsTool(session: AgentSession) {
  return tool(
    async ({ query, topK }: { query: string; topK?: number }) => {
      const results = await searchComponents(query, topK ?? 5);

      if (results.length === 0) {
        return JSON.stringify({
          results: [],
          message:
            "No components found. The registry may be empty — run `pnpm agent:index` first.",
        });
      }

      return JSON.stringify({
        results: results.map(([doc, score]) => {
          const meta = doc.metadata as ComponentMetadata;

          recordComponentReference(session, {
            id: meta.id,
            name: meta.name,
            description: meta.description,
            yamlText: meta.yamlText,
          });

          return {
            id: meta.id,
            name: meta.name,
            description: meta.description,
            score: Math.round(score * 1000) / 1000,
            inputs: meta.inputs,
            outputs: meta.outputs,
            yamlText:
              meta.yamlText.length > 2000
                ? meta.yamlText.substring(0, 2000) + "\n... (truncated)"
                : meta.yamlText,
          };
        }),
      });
    },
    {
      name: "search_components",
      description:
        "Search the Tangle component registry by semantic meaning. Returns results with an `id` field — use it in `[Name](component://id)` links. Use before creating any new component to check if a suitable one already exists.",
      schema: z.object({
        query: z
          .string()
          .describe(
            "Natural language description of the component's function",
          ),
        topK: z
          .number()
          .optional()
          .describe("Number of results to return (default 5)"),
      }),
    },
  );
}
