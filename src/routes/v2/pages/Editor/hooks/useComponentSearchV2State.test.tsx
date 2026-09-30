import { act, renderHook } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

import { buildSearchIndex } from "@/services/componentSearchIndex";
import type { ComponentReference } from "@/utils/componentSpec";

import { useComponentSearchV2State } from "./useComponentSearchV2State";

const mocks = vi.hoisted(() => ({
  standard: [] as ComponentReference[],
  published: [] as ComponentReference[],
  user: [] as ComponentReference[],
  isHydrating: false,
  mutate: vi.fn(),
  reset: vi.fn(),
  cancel: vi.fn(),
}));

vi.mock("@/providers/BackendProvider", () => ({
  useBackend: () => ({
    backendUrl: "https://backend.example.com",
    configured: true,
    available: true,
  }),
}));
vi.mock("dexie-react-hooks", () => ({ useLiveQuery: () => [] }));
vi.mock("@/hooks/useNaturalLanguageComponentSearch", () => ({
  useNaturalLanguageComponentRerank: () => ({
    mutate: mocks.mutate,
    reset: mocks.reset,
    cancel: mocks.cancel,
    isPending: false,
    isConfigured: true,
  }),
}));
vi.mock("@tanstack/react-query", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-query")>()),
  useQueryClient: () => ({}),
  useQuery: ({ queryKey }: { queryKey: string[] }) => {
    if (queryKey[0] === "componentLibrary")
      return {
        data: { folders: [{ name: "Standard", components: mocks.standard }] },
      };
    if (queryKey[0] === "userComponents")
      return { data: { components: mocks.user } };
    if (queryKey[1] === "published") return { data: mocks.published };
    if (queryKey[1] === "registered-libraries") return { data: [] };
    if (queryKey[1] === "search-index")
      return {
        data: buildSearchIndex([
          ...mocks.standard.map((reference) => ({
            reference,
            source: {
              kind: "standard" as const,
              id: "standard",
              label: "Standard",
            },
          })),
          ...mocks.published.map((reference) => ({
            reference,
            source: {
              kind: "published" as const,
              id: "published",
              label: "Published",
            },
          })),
          ...mocks.user.map((reference) => ({
            reference,
            source: { kind: "user" as const, id: "user", label: "User" },
          })),
        ]),
        isFetching: mocks.isHydrating,
      };
    throw new Error(`Unexpected query: ${queryKey.join("/")}`);
  },
}));

function component(digest: string, name: string): ComponentReference {
  return {
    digest,
    spec: { name, implementation: { container: { image: "example" } } },
  };
}

beforeEach(() => {
  mocks.standard = Array.from({ length: 100 }, (_, index) =>
    component(`standard-${index}`, `Train model ${index}`),
  );
  mocks.published = [component("published", "Fit classifier")];
  mocks.user = [component("user", "Prepare dataset")];
  mocks.isHydrating = false;
  vi.clearAllMocks();
});

it.each(["train", "query with no keyword overlap"])(
  "searches every loaded source for %s",
  (query) => {
    const { result } = renderHook(() => useComponentSearchV2State(query));
    expect(result.current.canRerank).toBe(true);
    expect(mocks.mutate).not.toHaveBeenCalled();
    act(() => result.current.rerank());
    const { candidates } = mocks.mutate.mock.calls[0][0];
    expect(candidates).toHaveLength(102);
    expect(candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "published",
          source: { kind: "published", label: "Published" },
        }),
        expect.objectContaining({ id: "user" }),
      ]),
    );
  },
);

it("excludes disabled sources from AI requests", () => {
  const { result } = renderHook(() => useComponentSearchV2State("train"));
  act(() => result.current.toggleSourceFilter("published"));
  act(() => result.current.rerank());
  expect(mocks.mutate.mock.calls[0][0].candidates).toHaveLength(101);
  expect(mocks.mutate.mock.calls[0][0].candidates).not.toEqual(
    expect.arrayContaining([expect.objectContaining({ id: "published" })]),
  );
});

it("waits for component specifications before enabling AI search", () => {
  mocks.isHydrating = true;
  const { result, rerender } = renderHook(() =>
    useComponentSearchV2State("train"),
  );
  expect(result.current.canRerank).toBe(false);
  act(() => result.current.rerank());
  expect(mocks.mutate).not.toHaveBeenCalled();
  mocks.isHydrating = false;
  rerender();
  expect(result.current.canRerank).toBe(true);
});

it("does not start a search while typing is pending", () => {
  const { result } = renderHook(() =>
    useComponentSearchV2State("train", { pauseSearch: true }),
  );
  expect(result.current.canRerank).toBe(false);
  act(() => result.current.rerank());
  expect(mocks.mutate).not.toHaveBeenCalled();
});
