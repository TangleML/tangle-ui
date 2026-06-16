import type { ToolBridgeApi } from "@/agent/toolBridgeApi";
import { listApiPublishedComponentsGet } from "@/api/sdk.gen";
import {
  fetchUserComponents,
  flattenFolders,
} from "@/providers/ComponentLibraryProvider/componentLibrary";
import { createLibraryObject } from "@/providers/ComponentLibraryProvider/libraries/factory";
import { ensureLibraryFactoriesRegistered } from "@/providers/ComponentLibraryProvider/libraries/setup";
import { LibraryDB } from "@/providers/ComponentLibraryProvider/libraries/storage";
import {
  buildSearchIndex,
  type ComponentSearchSource,
  lexicalSearch,
  type SourcedReference,
} from "@/services/componentSearchIndex";
import {
  fetchAndStoreComponentLibrary,
  hydrateComponentReference,
} from "@/services/componentService";
import type { ComponentFolder } from "@/types/componentLibrary";
import type { ComponentReference } from "@/utils/componentSpec";
import { componentSpecToYaml } from "@/utils/yaml";

import type { BridgeDeps } from "./utils";

const SEARCH_STALE_TIME = 1000 * 60 * 60;
const DEFAULT_LIMIT = 8;
const MAX_LIMIT = 20;

const STANDARD_SOURCE: ComponentSearchSource = {
  kind: "standard",
  label: "Standard",
  id: "standard",
};

const PUBLISHED_SOURCE: ComponentSearchSource = {
  kind: "published",
  label: "Published",
  id: "published",
};

const USER_SOURCE: ComponentSearchSource = {
  kind: "user",
  label: "User",
  id: "user",
};

type ComponentSearchHandlers = Pick<ToolBridgeApi, "searchComponents">;

async function ensureData<T>(
  deps: BridgeDeps,
  queryKey: readonly unknown[],
  queryFn: () => Promise<T>,
): Promise<T> {
  if (!deps.queryClient) return queryFn();
  return deps.queryClient.ensureQueryData({
    queryKey,
    queryFn,
    staleTime: SEARCH_STALE_TIME,
  });
}

async function collectPublishedReferences(
  deps: BridgeDeps,
): Promise<ComponentReference[]> {
  const backendUrl = deps.getBackendUrl?.().replace(/\/+$/, "");
  if (!backendUrl) return [];

  try {
    const result = await listApiPublishedComponentsGet({});
    if (result.response.status !== 200 || !result.data) return [];

    return (result.data.published_components ?? [])
      .filter((component) => !component.deprecated)
      .map((component) => ({
        digest: component.digest,
        name: component.name ?? undefined,
        url:
          component.url ?? `${backendUrl}/api/components/${component.digest}`,
        published_by: component.published_by,
      }));
  } catch {
    return [];
  }
}

async function collectRegisteredReferences(): Promise<SourcedReference[]> {
  ensureLibraryFactoriesRegistered();
  const libraries = await LibraryDB.component_libraries.toArray();
  if (libraries.length === 0) return [];

  const results = await Promise.allSettled(
    libraries.map(async (library) => {
      const componentLibrary = createLibraryObject(library);
      const folder: ComponentFolder = await componentLibrary.getComponents({});
      return { library, folder };
    }),
  );

  const sourced: SourcedReference[] = [];
  for (const result of results) {
    if (result.status !== "fulfilled") continue;
    const source: ComponentSearchSource = {
      kind: "registered",
      label: result.value.library.name,
      id: result.value.library.id,
    };
    for (const reference of flattenFolders(result.value.folder)) {
      sourced.push({ reference, source });
    }
  }
  return sourced;
}

function dedupeByDigest(sourcedReferences: SourcedReference[]) {
  const seen = new Set<string>();
  return sourcedReferences.filter((item) => {
    const digest = item.reference.digest;
    if (!digest || seen.has(digest)) return false;
    seen.add(digest);
    return true;
  });
}

async function buildSourcedReferences(
  deps: BridgeDeps,
): Promise<SourcedReference[]> {
  const [standardLibrary, userFolder, publishedRefs, registeredRefs] =
    await Promise.all([
      ensureData(deps, ["componentLibrary"], fetchAndStoreComponentLibrary),
      ensureData(deps, ["userComponents"], fetchUserComponents),
      ensureData(
        deps,
        ["component-search-v2", "published", deps.getBackendUrl?.() ?? ""],
        () => collectPublishedReferences(deps),
      ),
      ensureData(
        deps,
        ["component-search-v2", "registered-libraries"],
        collectRegisteredReferences,
      ),
    ]);

  return dedupeByDigest([
    ...flattenFolders(standardLibrary).map((reference) => ({
      reference,
      source: STANDARD_SOURCE,
    })),
    ...publishedRefs.map((reference) => ({
      reference,
      source: PUBLISHED_SOURCE,
    })),
    ...registeredRefs,
    ...(userFolder.components ?? []).map((reference) => ({
      reference,
      source: USER_SOURCE,
    })),
  ]);
}

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
      const sourcedReferences = await buildSourcedReferences(deps);
      const hydratedResults = await Promise.all(
        sourcedReferences.map(async (item) => {
          const reference = await ensureData(
            deps,
            [
              "component",
              "hydrate",
              item.reference.digest ?? item.reference.url,
            ],
            () => hydrateComponentReference(item.reference),
          ).catch(() => null);
          return reference ? { reference, source: item.source } : null;
        }),
      );
      const hydratedReferences: SourcedReference[] = hydratedResults.filter(
        (item): item is NonNullable<(typeof hydratedResults)[number]> =>
          item !== null,
      );

      const index = buildSearchIndex(hydratedReferences);
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
