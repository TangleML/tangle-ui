import { tool } from "@openai/agents";
import { z } from "zod";

import type { AgentSession } from "../session";

function asJson(value: unknown): string {
  return JSON.stringify(value);
}

export function createComponentSearchTools(session: AgentSession) {
  const searchComponents = tool({
    name: "search_components",
    description:
      "Search the available Tangle component library by natural-language intent or keywords. Use this when the user asks to find, list, choose, add, or build with components that may not already be on the canvas. Each result's `id` is what `add_task` takes as `componentId` — the component itself is held here, so you never have to repeat its spec back.",
    parameters: z.object({
      query: z
        .string()
        .describe(
          "The user's component intent, e.g. 'upload a file', 'train xgboost', or 'read csv'.",
        ),
      limit: z
        .number()
        .int()
        .min(1)
        .max(20)
        .nullable()
        .optional()
        .describe("Maximum results to return. Defaults to 8."),
    }),
    execute: async ({ query, limit }) => {
      const searchResult = await session.bridge.searchComponents({
        query,
        limit: limit ?? undefined,
      });

      for (const result of searchResult.results) {
        session.componentCatalog.remember(result.id, result.componentRef);
        if (!result.yamlText) continue;
        session.componentReferences[result.id] = {
          name: result.name,
          yamlText: result.yamlText,
        };
      }

      return asJson({
        ...searchResult,
        results: searchResult.results.map(
          ({
            yamlText: _yamlText,
            componentRef: _componentRef,
            ...result
          }) => ({
            ...result,
            componentLink: `[${result.name}](component://${result.id})`,
          }),
        ),
      });
    },
  });

  return { searchComponents };
}
