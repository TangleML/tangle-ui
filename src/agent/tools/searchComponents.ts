/**
 * Semantic component search — delegated to the Tangle backend.
 *
 * Replaces the in-browser MemoryVectorStore + OpenAIEmbeddings approach.
 * The backend owns the vector index and embedding model, the worker just
 * issues a query and surfaces results to the agent.
 *
 * `recordComponentReference` is still called for every hit so that any
 * `[Name](component://id)` link the agent emits in its final answer can be
 * resolved back to a chip on the main thread.
 */
import { tool } from "@openai/agents";
import { z } from "zod";

import { config } from "../config";
import type { AgentSession } from "../session";
import { recordComponentReference } from "../session";

interface ComponentSearchResult {
  id: string;
  name: string;
  description: string;
  score: number;
  inputs: Array<{ name: string; type?: string }>;
  outputs: Array<{ name: string; type?: string }>;
  yamlText: string;
}

interface ComponentSearchResponse {
  results: ComponentSearchResult[];
  message?: string;
}

async function searchComponentsApi(
  query: string,
  topK: number,
): Promise<ComponentSearchResponse> {
  const url = `${config.tangleApiUrl}/api/agent/search_components`;
  const res = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, topK }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Tangle API ${res.status}: ${body}`);
  }
  return (await res.json()) as ComponentSearchResponse;
}

export function createSearchComponentsTool(session: AgentSession) {
  return tool({
    name: "search_components",
    description:
      "Search the Tangle component registry by semantic meaning. Returns results with an `id` field — use it in `[Name](component://id)` links. Use before assembling any task to find the right component.",
    parameters: z.object({
      query: z
        .string()
        .describe("Natural language description of the component's function"),
      topK: z
        .number()
        .nullable()
        .optional()
        .describe("Number of results to return (default 5)"),
    }),
    execute: async ({ query, topK }) => {
      try {
        const response = await searchComponentsApi(query, topK ?? 5);

        if (response.results.length === 0) {
          return JSON.stringify({
            results: [],
            message: response.message ?? "No components found for that query.",
          });
        }

        return JSON.stringify({
          results: response.results.map((result) => {
            recordComponentReference(session, {
              id: result.id,
              name: result.name,
              description: result.description,
              yamlText: result.yamlText,
            });

            return {
              id: result.id,
              name: result.name,
              description: result.description,
              score: Math.round(result.score * 1000) / 1000,
              inputs: result.inputs,
              outputs: result.outputs,
              yamlText:
                result.yamlText.length > 2000
                  ? result.yamlText.substring(0, 2000) + "\n... (truncated)"
                  : result.yamlText,
            };
          }),
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return JSON.stringify({ results: [], error: message });
      }
    },
  });
}
