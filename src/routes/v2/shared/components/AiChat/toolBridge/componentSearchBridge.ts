import type { ToolBridgeApi } from "@/agent/toolBridgeApi";
import { loadComponentSearchCatalog } from "@/services/componentSearchCatalog";
import { lexicalSearch } from "@/services/componentSearchIndex";
import type { ComponentReference } from "@/utils/componentSpec";
import { componentSpecToYaml } from "@/utils/yaml";

import type { BridgeDeps } from "./utils";

const DEFAULT_LIMIT = 8;
const MAX_LIMIT = 20;

type ComponentSearchHandlers = Pick<ToolBridgeApi, "searchComponents">;

function componentReferenceForTool(reference: ComponentReference) {
  return {
    name: reference.name ?? reference.spec?.name ?? "Component",
    ...(reference.url ? { url: reference.url } : {}),
    ...(!reference.url && reference.spec ? { spec: reference.spec } : {}),
  };
}

function yamlTextForReference(reference: ComponentReference): string | null {
  if (reference.text) return reference.text;
  if (reference.spec) return componentSpecToYaml(reference.spec);
  return null;
}

export function createComponentSearchBridgeHandlers(
  deps: BridgeDeps,
): ComponentSearchHandlers {
  return {
    async searchComponents({ query, limit }) {
      const trimmedQuery = query.trim();
      if (trimmedQuery.length === 0) {
        return { success: false, results: [], error: "Search query is empty." };
      }

      const resultLimit = Math.min(
        Math.max(limit ?? DEFAULT_LIMIT, 1),
        MAX_LIMIT,
      );
      const { index } = await loadComponentSearchCatalog(
        deps.getBackendUrl?.().replace(/\/+$/, "") ?? "",
        deps.queryClient,
      );
      const matches = lexicalSearch(index, trimmedQuery, {
        limit: resultLimit,
        minLength: 1,
      });

      return {
        success: true,
        results: matches.map((match) => {
          const spec = match.reference.spec;
          return {
            id: match.digest,
            name: match.name,
            description: spec?.description ?? "",
            source: match.source.label,
            matchedFields: match.matchedFields,
            inputs:
              spec?.inputs
                ?.map((input) => input.name)
                .filter((name): name is string => Boolean(name)) ?? [],
            outputs:
              spec?.outputs
                ?.map((output) => output.name)
                .filter((name): name is string => Boolean(name)) ?? [],
            componentRef: componentReferenceForTool(match.reference),
            yamlText: yamlTextForReference(match.reference),
          };
        }),
      };
    },
  };
}
