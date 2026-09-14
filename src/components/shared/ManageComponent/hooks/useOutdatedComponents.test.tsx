import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { type ReactNode, Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { hydrateComponentReference } from "@/services/componentService";
import type {
  ComponentReference,
  HydratedComponentReference,
} from "@/utils/componentSpec";

import { hydrateAllComponents } from "../utils/hydrateAllComponents";
import { useOutdatedComponents } from "./useOutdatedComponents";

vi.mock("@/services/componentService", () => ({
  hydrateComponentReference: vi.fn(),
}));

vi.mock("../utils/hydrateAllComponents", () => ({
  hydrateAllComponents: vi.fn(),
}));

vi.mock("../../GitHubLibrary/utils/checkComponentUpdates", () => ({
  checkComponentUpdates: vi.fn(),
}));

vi.mock(
  "@/providers/ComponentLibraryProvider/ComponentLibraryProvider",
  () => ({
    useComponentLibrary: () => ({
      existingComponentLibraries: [],
      getComponentLibrary: vi.fn(),
    }),
  }),
);

vi.mock("./useAllPublishedComponents", () => ({
  useAllPublishedComponents: () => ({
    data: { components: publishedComponents },
  }),
}));

let publishedComponents: ComponentReference[];
let queryClient: QueryClient;

function createHydratedComponent(digest: string): HydratedComponentReference {
  return {
    digest,
    name: digest,
    spec: {
      name: digest,
      implementation: { container: { image: "test" } },
    },
    text: `name: ${digest}\nimplementation:\n  container:\n    image: test\n`,
  };
}

const original = createHydratedComponent("original");
const intermediate = createHydratedComponent("intermediate");
const latest = createHydratedComponent("latest");
const latestReference: ComponentReference = {
  digest: latest.digest,
  url: "https://example.com/latest.yaml",
};

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={null}>
        <ErrorBoundary fallback={null}>{children}</ErrorBoundary>
      </Suspense>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  publishedComponents = [];
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  vi.mocked(hydrateAllComponents).mockResolvedValue([original]);
});

afterEach(() => {
  cleanup();
  queryClient.clear();
});

describe("useOutdatedComponents", () => {
  it("does not hydrate published components when no components are used", async () => {
    publishedComponents = [latestReference];
    vi.mocked(hydrateAllComponents).mockResolvedValue([]);

    const { result } = renderHook(() => useOutdatedComponents([]), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current?.data).toEqual([]));
    expect(hydrateComponentReference).not.toHaveBeenCalled();
  });

  it("does not hydrate a published version that is already in use", async () => {
    publishedComponents = [
      { digest: original.digest, superseded_by: latest.digest },
      latestReference,
    ];
    vi.mocked(hydrateAllComponents).mockResolvedValue([latest]);

    const { result } = renderHook(() => useOutdatedComponents([latest]), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current?.data).toEqual([]));
    expect(hydrateComponentReference).not.toHaveBeenCalled();
  });

  it("ignores unavailable published components unrelated to the used components", async () => {
    publishedComponents = [
      { digest: "unrelated-original", superseded_by: "unavailable" },
      { digest: "unavailable", url: "https://example.com/unavailable.yaml" },
      { digest: "standalone", url: "https://example.com/standalone.yaml" },
      { digest: original.digest, superseded_by: latest.digest },
      latestReference,
    ];
    vi.mocked(hydrateComponentReference).mockImplementation(
      async (component) => {
        if (component.digest === latest.digest) {
          return latest;
        }
        throw new Error("Failed to fetch component:");
      },
    );

    const { result } = renderHook(() => useOutdatedComponents([original]), {
      wrapper: Wrapper,
    });

    await waitFor(() =>
      expect(result.current?.data).toEqual([[original, latest]]),
    );
    expect(hydrateComponentReference).toHaveBeenCalledExactlyOnceWith(
      latestReference,
    );
  });

  it("hydrates the latest replacement once for all used versions in its chain", async () => {
    const inlineOriginal: ComponentReference = { spec: original.spec };
    publishedComponents = [
      { digest: original.digest, superseded_by: intermediate.digest },
      { digest: intermediate.digest, superseded_by: latest.digest },
      latestReference,
    ];
    vi.mocked(hydrateAllComponents).mockResolvedValue([original, intermediate]);
    vi.mocked(hydrateComponentReference).mockResolvedValue(latest);

    const { result } = renderHook(
      () => useOutdatedComponents([inlineOriginal, intermediate]),
      { wrapper: Wrapper },
    );

    await waitFor(() =>
      expect(result.current?.data).toEqual([
        [original, latest],
        [intermediate, latest],
      ]),
    );
    expect(hydrateAllComponents).toHaveBeenCalledWith([
      inlineOriginal,
      intermediate,
    ]);
    expect(hydrateComponentReference).toHaveBeenCalledExactlyOnceWith(
      latestReference,
    );
  });

  it("omits replacements that cannot be hydrated", async () => {
    publishedComponents = [
      { digest: original.digest, superseded_by: latest.digest },
      latestReference,
    ];
    vi.mocked(hydrateComponentReference).mockResolvedValue(null);

    const { result } = renderHook(() => useOutdatedComponents([original]), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current?.data).toEqual([]));
    expect(hydrateComponentReference).toHaveBeenCalledExactlyOnceWith(
      latestReference,
    );
  });

  it("retries transient failures for a replacement that is needed", async () => {
    publishedComponents = [
      { digest: original.digest, superseded_by: latest.digest },
      latestReference,
    ];
    queryClient.setDefaultOptions({
      queries: { retry: 1, retryDelay: 0 },
    });
    vi.mocked(hydrateComponentReference)
      .mockRejectedValueOnce(new Error("Failed to fetch component:"))
      .mockResolvedValue(latest);

    const { result } = renderHook(() => useOutdatedComponents([original]), {
      wrapper: Wrapper,
    });

    await waitFor(() =>
      expect(result.current?.data).toEqual([[original, latest]]),
    );
    expect(hydrateComponentReference).toHaveBeenCalledTimes(2);
    expect(hydrateComponentReference).toHaveBeenNthCalledWith(
      1,
      latestReference,
    );
    expect(hydrateComponentReference).toHaveBeenNthCalledWith(
      2,
      latestReference,
    );
  });
});
