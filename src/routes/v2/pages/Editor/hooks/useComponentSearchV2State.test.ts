import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { StoredLibrary } from "@/providers/ComponentLibraryProvider/libraries/storage";
import type { ComponentLibrary } from "@/types/componentLibrary";
import type { ComponentReference } from "@/utils/componentSpec";

import { useComponentSearchV2State } from "./useComponentSearchV2State";

const mocks = vi.hoisted(() => ({
  githubComponentLibraryEnabled: false,
  registeredLibraries: [] as StoredLibrary[],
  backend: {
    backendUrl: "https://backend.example",
    configured: true,
    available: true,
  },
  aiProviderSettings: {
    config: { apiBase: "", apiKey: "", model: "" },
  },
  naturalLanguageRerank: {
    mutate: () => {},
    reset: () => {},
    data: undefined,
    isPending: false,
    isConfigured: false,
  },
}));

vi.mock("@/components/shared/Settings/useFlags", () => ({
  useFlagValue: () => mocks.githubComponentLibraryEnabled,
}));

vi.mock("dexie-react-hooks", () => ({
  useLiveQuery: () => mocks.registeredLibraries,
}));

vi.mock("@/providers/ComponentLibraryProvider/libraries/storage", () => ({
  LibraryDB: {
    component_libraries: { toArray: async () => [] },
  },
}));

vi.mock("@/providers/ComponentLibraryProvider/libraries/setup", () => ({
  ensureLibraryFactoriesRegistered: () => {},
}));

vi.mock("@/providers/ComponentLibraryProvider/libraries/factory", () => ({
  createLibraryObject: () => ({
    getComponents: async () => ({
      name: "Acme",
      components: [ref("registered-digest", "Registered widget")],
    }),
  }),
}));

vi.mock(
  "@/providers/ComponentLibraryProvider/componentLibrary",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("@/providers/ComponentLibraryProvider/componentLibrary")
    >()),
    fetchUserComponents: async () => ({
      name: "User Components",
      components: [ref("user-digest", "User widget")],
    }),
  }),
);

vi.mock("@/services/componentService", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/componentService")>()),
  fetchAndStoreComponentLibrary: async (): Promise<ComponentLibrary> => ({
    folders: [
      {
        name: "ML",
        components: [ref("standard-digest", "Standard widget")],
      },
    ],
  }),
  hydrateComponentReference: async () => null,
}));

vi.mock("@/api/sdk.gen", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/api/sdk.gen")>()),
  listApiPublishedComponentsGet: async () => ({
    response: { status: 200 },
    data: {
      published_components: [
        {
          digest: "published-digest",
          name: "Published widget",
          url: "https://backend.example/published.yaml",
          published_by: "someone@example.com",
          deprecated: false,
        },
      ],
    },
  }),
}));

vi.mock("@/providers/BackendProvider", () => ({
  useBackend: () => mocks.backend,
}));

vi.mock("@/hooks/useAiProviderSettings", () => ({
  useAiProviderSettings: () => mocks.aiProviderSettings,
}));

// A fresh `reset` per render would re-fire the hook's reset effect, whose state updates re-render forever.
vi.mock("@/hooks/useNaturalLanguageComponentSearch", () => ({
  useNaturalLanguageComponentRerank: () => mocks.naturalLanguageRerank,
}));

function ref(digest: string, name: string): ComponentReference {
  return { digest, name, url: `https://example.com/${digest}.yaml` };
}

function storedLibrary(): StoredLibrary {
  return {
    id: "acme-library",
    name: "Acme",
    type: "github",
    knownDigests: ["registered-digest"],
  };
}

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client }, children);
  };
}

function browseFolderNames(
  result: Awaited<ReturnType<typeof renderLoaded>>,
): string[] {
  return result.current.browseFolders.map((folder) => folder.name);
}

async function renderLoaded(query: string) {
  const { result } = renderHook(() => useComponentSearchV2State(query), {
    wrapper: createWrapper(),
  });
  await waitFor(() => {
    expect(result.current.isLoading).toBe(false);
    expect(
      result.current.sourceFilterOptions.map((option) => option.source.kind),
    ).toContain("registered");
  });
  return result;
}

describe("useComponentSearchV2State", () => {
  beforeEach(() => {
    mocks.githubComponentLibraryEnabled = false;
    mocks.registeredLibraries = [storedLibrary()];
  });

  it("includes the Connected libraries browse folder when the github-component-library flag is off", async () => {
    mocks.githubComponentLibraryEnabled = false;

    const result = await renderLoaded("");

    expect(result.current.browseFolders.map((folder) => folder.name)).toEqual([
      "User Components",
      "Published Components",
      "Standard library",
      "Connected libraries",
    ]);
    const connected = result.current.browseFolders.find(
      (folder) => folder.name === "Connected libraries",
    );
    expect(connected?.folders?.map((folder) => folder.name)).toEqual(["Acme"]);
  });

  it("omits the Connected libraries browse folder when the github-component-library flag is on", async () => {
    mocks.githubComponentLibraryEnabled = true;

    const result = await renderLoaded("");

    expect(result.current.browseFolders.map((folder) => folder.name)).toEqual([
      "User Components",
      "Published Components",
      "Standard library",
    ]);
  });

  it("returns the same search results regardless of the github-component-library flag", async () => {
    mocks.githubComponentLibraryEnabled = false;
    const flagOff = await renderLoaded("widget");
    await waitFor(() => expect(flagOff.current.results).toHaveLength(4));
    const flagOffDigests = flagOff.current.results.map(
      (item) => item.reference.digest,
    );

    mocks.githubComponentLibraryEnabled = true;
    const flagOn = await renderLoaded("widget");
    await waitFor(() => expect(flagOn.current.results).toHaveLength(4));

    expect(browseFolderNames(flagOff)).toContain("Connected libraries");
    expect(browseFolderNames(flagOn)).not.toContain("Connected libraries");
    expect(flagOffDigests).toContain("registered-digest");
    expect(flagOn.current.results.map((item) => item.reference.digest)).toEqual(
      flagOffDigests,
    );
  });
});
