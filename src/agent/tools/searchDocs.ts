/**
 * Semantic docs search — delegated to the Tangle backend.
 *
 * Replaces the in-browser MemoryVectorStore + OpenAIEmbeddings approach.
 * The backend owns the docs vector index, the worker just forwards the
 * query and returns rendered results.
 */
import { tool } from "@openai/agents";
import { z } from "zod";

import { config } from "../config";

interface DocSearchResult {
  title: string;
  sectionTitle: string;
  content: string;
  url: string;
  score: number;
}

interface DocSearchResponse {
  results: DocSearchResult[];
  message?: string;
}

async function searchDocsApi(
  query: string,
  topK: number,
): Promise<DocSearchResponse> {
  const url = `${config.tangleApiUrl}/api/agent/search_docs`;
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
  return (await res.json()) as DocSearchResponse;
}

export const searchDocsTool = tool({
  name: "search_docs",
  description:
    "Search Tangle documentation by semantic meaning. Returns relevant doc sections with URLs to tangleml.com/docs. " +
    "Use for conceptual questions about Tangle. Each result includes a `url` and `citation` field — " +
    "always include the documentation link in your response.",
  parameters: z.object({
    query: z
      .string()
      .describe("Natural language question about Tangle concepts or features"),
    topK: z
      .number()
      .nullable()
      .optional()
      .describe("Number of results to return (default 5)"),
  }),
  execute: async ({ query, topK }) => {
    try {
      const response = await searchDocsApi(query, topK ?? 5);

      if (response.results.length === 0) {
        return JSON.stringify({
          results: [],
          message: response.message ?? "No docs found for that query.",
        });
      }

      return JSON.stringify({
        results: response.results.map((result) => ({
          title: result.title,
          sectionTitle: result.sectionTitle,
          content:
            result.content.length > 1500
              ? result.content.substring(0, 1500) + "\n... (truncated)"
              : result.content,
          url: result.url,
          citation: `[${result.title}](${result.url})`,
          score: Math.round(result.score * 1000) / 1000,
        })),
        instruction:
          "IMPORTANT: You MUST include the `url` from the top result(s) in your response as a markdown link. " +
          "Use the `citation` field directly, e.g. 'Learn more: [Title](url)'.",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return JSON.stringify({ results: [], error: message });
    }
  },
});
