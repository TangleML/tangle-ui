import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useComponentSearchCatalog } from "@/hooks/useComponentSearchCatalog";
import type { StoredLibrary } from "@/providers/ComponentLibraryProvider/libraries/storage";
import type { ComponentReference } from "@/utils/componentSpec";

import { loadComponentSearchCatalog } from "./componentSearchCatalog";

const mocks = vi.hoisted(() => ({
  standard: vi.fn(),
  user: vi.fn(),
  published: vi.fn(),
  hydrate: vi.fn(),
  registered: vi.fn(),
  libraries: [] as StoredLibrary[],
}));

vi.mock("@/services/componentService", () => ({
  fetchAndStoreComponentLibrary: mocks.standard,
  hydrateComponentReference: mocks.hydrate,
}));
vi.mock(
  "@/providers/ComponentLibraryProvider/componentLibrary",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("@/providers/ComponentLibraryProvider/componentLibrary")
    >()),
    fetchUserComponents: mocks.user,
  }),
);
vi.mock("@/api/sdk.gen", () => ({
  listApiPublishedComponentsGet: mocks.published,
}));
vi.mock("@/providers/ComponentLibraryProvider/libraries/setup", () => ({
  ensureLibraryFactoriesRegistered: vi.fn(),
}));
vi.mock("@/providers/ComponentLibraryProvider/libraries/factory", () => ({
  createLibraryObject: (library: StoredLibrary) => ({
    getComponents: () => mocks.registered(library),
  }),
}));
vi.mock("@/providers/ComponentLibraryProvider/libraries/storage", () => ({
  LibraryDB: { component_libraries: { toArray: async () => mocks.libraries } },
}));
vi.mock("dexie-react-hooks", () => ({ useLiveQuery: () => mocks.libraries }));
vi.mock("@/providers/BackendProvider", () => ({
  useBackend: () => ({
    backendUrl: "https://backend.example.com",
    configured: true,
    available: true,
  }),
}));
vi.mock("@/services/errorManagement/bugsnag", () => ({
  IS_BUGSNAG_ENABLED: false,
}));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("shared component search catalogue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.libraries = [];
    mocks.standard.mockResolvedValue({
      folders: [
        {
          name: "Standard",
          components: [{ digest: "standard", name: "Load CSV" }],
        },
      ],
    });
    mocks.user.mockResolvedValue({ name: "User Components", components: [] });
    mocks.published.mockResolvedValue({
      response: { status: 200 },
      data: { published_components: [] },
    });
    mocks.registered.mockImplementation(async (library: StoredLibrary) => ({
      name: library.name,
      components: library.knownDigests.map((digest) => ({
        digest,
        name: digest,
      })),
    }));
    mocks.hydrate.mockImplementation(async (reference: ComponentReference) => ({
      ...reference,
      text: "component yaml",
      spec: {
        name: reference.name,
        description: "Parse a CSV dataset",
        implementation: { container: { image: "python:3" } },
      },
    }));
  });

  afterEach(() => {
    queryClient.clear();
    vi.restoreAllMocks();
  });

  it("defers editor hydration until search, then shares the cached index with the agent", async () => {
    const { result, rerender, unmount } = renderHook(
      ({ hydrate }) => useComponentSearchCatalog(hydrate),
      { initialProps: { hydrate: false }, wrapper },
    );
    await waitFor(() => expect(result.current.references).toHaveLength(1));
    expect(mocks.hydrate).not.toHaveBeenCalled();
    expect(result.current.index).toHaveLength(0);

    rerender({ hydrate: true });
    await waitFor(() => expect(result.current.index).toHaveLength(1));
    const agent = await loadComponentSearchCatalog(
      "https://backend.example.com",
      queryClient,
    );
    expect(agent.index).toEqual(result.current.index);
    expect(mocks.hydrate).toHaveBeenCalledTimes(1);
    unmount();
  });

  it("hydrates dashboard browse data eagerly and normalizes active published components", async () => {
    mocks.published.mockResolvedValue({
      response: { status: 200 },
      data: {
        published_components: [
          { digest: "published", name: null, url: null, deprecated: false },
          { digest: "retired", name: "Retired", deprecated: true },
        ],
      },
    });
    const { result, unmount } = renderHook(
      () => useComponentSearchCatalog(true),
      { wrapper },
    );
    await waitFor(() => expect(result.current.index).toHaveLength(2));
    expect(mocks.published).toHaveBeenCalledWith({
      baseUrl: "https://backend.example.com",
    });
    expect(
      result.current.references.find(
        ({ source }) => source.kind === "published",
      )?.reference,
    ).toMatchObject({
      digest: "published",
      url: "https://backend.example.com/api/components/published",
    });
    expect(
      result.current.references.some(
        ({ reference }) => reference.digest === "retired",
      ),
    ).toBe(false);
    unmount();
  });

  it("reloads registered libraries when their contents change", async () => {
    mocks.libraries = [
      {
        id: "connected",
        name: "Connected",
        type: "yaml",
        knownDigests: ["first"],
      },
    ];
    const first = await loadComponentSearchCatalog("", queryClient);
    expect(first.index.map((entry) => entry.digest)).toEqual([
      "standard",
      "first",
    ]);

    mocks.libraries = [{ ...mocks.libraries[0], knownDigests: ["second"] }];
    const second = await loadComponentSearchCatalog("", queryClient);
    expect(second.index.map((entry) => entry.digest)).toEqual([
      "standard",
      "second",
    ]);
    expect(mocks.registered).toHaveBeenCalledTimes(2);
  });

  it("keeps available sources when one library or component cannot load", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    mocks.libraries = [
      { id: "broken", name: "Broken", type: "yaml", knownDigests: [] },
      {
        id: "available",
        name: "Available",
        type: "yaml",
        knownDigests: ["ok", "invalid"],
      },
    ];
    mocks.registered.mockImplementation(async (library: StoredLibrary) => {
      if (library.id === "broken") throw new Error("Unavailable library");
      return {
        name: library.name,
        components: library.knownDigests.map((digest) => ({
          digest,
          name: digest,
        })),
      };
    });
    const hydrate = mocks.hydrate.getMockImplementation()!;
    mocks.hydrate.mockImplementation((reference: ComponentReference) =>
      reference.digest === "invalid"
        ? Promise.reject(new Error("Invalid component"))
        : hydrate(reference),
    );
    const result = await loadComponentSearchCatalog("", queryClient);
    expect(result.index.map((entry) => entry.digest)).toEqual([
      "standard",
      "ok",
    ]);
  });
});
