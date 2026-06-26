import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { StoredLibrary } from "@/providers/ComponentLibraryProvider/libraries/storage";
import type { IndexEntry } from "@/services/componentSearchIndex";
import type { ComponentReference } from "@/utils/componentSpec";

interface DashboardComponentsV2Search {
  component?: string;
}

const routeMocks = vi.hoisted(() => {
  const makeComponent = (digest: string, name: string): ComponentReference => ({
    digest,
    name,
    text: "component yaml",
    spec: {
      name,
      description: `${name} description`,
      implementation: { container: { image: "python:3.11" } },
    },
  });

  const search: DashboardComponentsV2Search = {};
  const descriptionErrorState: { current: Error | null } = { current: null };

  return {
    standard: makeComponent("standard-digest", "Standard component"),
    registered: makeComponent("registered-digest", "Registered component"),
    user: makeComponent("user-digest", "User component"),
    navigate: vi.fn(),
    notify: vi.fn(),
    refetchDescription: vi.fn(),
    rerank: vi.fn(),
    resetRerank: vi.fn(),
    descriptionErrorState,
    aiDescriptionsEnabled: false,
    aiSearchConfigured: false,
    search,
  };
});

vi.mock("@tanstack/react-query", () => ({
  queryOptions: (options: unknown) => options,
  useQueryClient: () => ({ ensureQueryData: vi.fn() }),
  useQuery: ({ queryKey }: { queryKey: readonly unknown[] }) => {
    const key = queryKey[0];

    if (key === "componentLibrary") {
      return {
        data: {
          name: "Standard",
          components: [routeMocks.standard],
          folders: [],
        },
        isLoading: false,
      };
    }

    if (key === "userComponents") {
      return {
        data: { components: [routeMocks.user] },
        isLoading: false,
      };
    }

    if (key === "component-search-v2" && queryKey[1] === "published") {
      return { data: [], isLoading: false };
    }

    if (
      key === "component-search-v2" &&
      queryKey[1] === "registered-libraries"
    ) {
      return {
        data: [
          {
            reference: routeMocks.registered,
            source: {
              kind: "registered",
              label: "GitHub library",
              id: "github-lib",
            },
          },
        ],
        isLoading: false,
      };
    }

    if (key === "component-search-v2" && queryKey[1] === "hydrate-library") {
      return {
        data: [routeMocks.standard, routeMocks.registered, routeMocks.user],
        isLoading: false,
      };
    }

    return { data: undefined, isLoading: false };
  },
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
  useNavigate: () => routeMocks.navigate,
  useSearch: () => routeMocks.search,
}));

vi.mock("dexie-react-hooks", () => ({
  useLiveQuery: () => [],
}));

vi.mock("@/providers/BackendProvider", () => ({
  useBackend: () => ({
    backendUrl: "https://backend.example",
    configured: false,
    available: false,
  }),
}));

vi.mock("@/components/shared/Settings/useFlags", () => ({
  useFlagValue: () => routeMocks.aiDescriptionsEnabled,
}));

vi.mock("@/hooks/useNaturalLanguageComponentSearch", () => ({
  useComponentAiDescription: ({
    reference,
    enabled,
  }: {
    reference: ComponentReference | undefined;
    enabled: boolean;
  }) => {
    const error = routeMocks.descriptionErrorState.current;
    // Simulate React Query's auto-fetch: when `enabled` is true and we have a
    // hydrated reference, the query fires on mount/key-change. A pre-seeded
    // error short-circuits the auto-fetch (retry: false → an errored query
    // stays errored without re-firing).
    if (enabled && reference?.digest && reference.spec && !error) {
      routeMocks.refetchDescription(reference);
    }
    return {
      description: undefined,
      isFetching: false,
      error,
      refetch: () => routeMocks.refetchDescription(reference),
      isConfigured: true,
    };
  },
  useNaturalLanguageComponentRerank: () => ({
    mutate: routeMocks.rerank,
    data: undefined,
    isPending: false,
    error: null,
    reset: routeMocks.resetRerank,
    isConfigured: routeMocks.aiSearchConfigured,
  }),
}));

vi.mock("@/hooks/useToastNotification", () => ({
  default: () => routeMocks.notify,
}));

vi.mock("@/components/shared/ComponentDetail/ComponentDetail", () => ({
  ComponentDetail: () => <div>Component detail</div>,
  ComponentDetailSkeleton: () => <div>Loading component detail</div>,
}));

vi.mock("@/components/shared/SuspenseWrapper", () => ({
  SuspenseWrapper: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  withSuspenseWrapper:
    (Component: React.ComponentType) => (props: Record<string, unknown>) => (
      <Component {...props} />
    ),
}));

vi.mock("../v2/shared/clipboard/copyComponentReferenceToClipboard", () => ({
  copyComponentReferenceToClipboard: vi.fn(),
}));

vi.mock("../router", () => ({
  APP_ROUTES: {
    DASHBOARD_COMPONENTS_V2: "/dashboard/components-v2",
    SETTINGS_AGENT: "/settings/agent",
  },
}));

import {
  createSourceFilterOptions,
  filterIndexByDisabledSourceKeys,
  SourceFilterBar,
  type SourceFilterOption,
} from "./DashboardComponentsV2SourceFilter";
import {
  createRegisteredLibrariesFingerprint,
  DashboardComponentsV2View,
} from "./DashboardComponentsV2View";

const options: SourceFilterOption[] = [
  {
    source: { kind: "standard", label: "Standard", id: "standard" },
    count: 2,
  },
  {
    source: {
      kind: "registered",
      label: "Registered libraries",
      id: "registered",
    },
    count: 3,
  },
  {
    source: { kind: "user", label: "User generated", id: "user" },
    count: 1,
  },
];

function createIndexEntry(
  digest: string,
  source: IndexEntry["source"],
): IndexEntry {
  return {
    digest,
    source,
    reference: { digest },
    name: digest,
    searchable: {
      name: digest,
      description: "",
      io: "",
      implementation: "",
      metadata: "",
    },
  };
}

describe("createRegisteredLibrariesFingerprint", () => {
  it("excludes secret-bearing library configuration", () => {
    const libraries: StoredLibrary[] = [
      {
        id: "github-lib",
        name: "GitHub",
        type: "github",
        knownDigests: ["digest-1"],
        configuration: {
          repo_name: "owner/repo",
          last_updated_at: "2026-01-01T00:00:00Z",
          access_token: "ghp_secret-token",
          auto_update: true,
        },
      },
    ];

    const fingerprint = createRegisteredLibrariesFingerprint(libraries);

    expect(fingerprint).toContain("owner/repo");
    expect(fingerprint).not.toContain("ghp_secret-token");
    expect(fingerprint).not.toContain("access_token");
  });

  it("changes when known digest values change without count changes", () => {
    const createLibrary = (knownDigests: string[]): StoredLibrary => ({
      id: "github-lib",
      name: "GitHub",
      type: "github",
      knownDigests,
      configuration: {
        repo_name: "owner/repo",
        last_updated_at: "2026-01-01T00:00:00Z",
        access_token: "ghp_secret-token",
        auto_update: true,
      },
    });

    expect(
      createRegisteredLibrariesFingerprint([createLibrary(["a", "b"])]),
    ).not.toEqual(
      createRegisteredLibrariesFingerprint([createLibrary(["c", "d"])]),
    );
  });
});

describe("createSourceFilterOptions", () => {
  it("groups multiple registered libraries into one registered filter", () => {
    const result = createSourceFilterOptions([
      createIndexEntry("github-component", {
        kind: "registered",
        label: "GitHub library",
        id: "github-lib",
      }),
      createIndexEntry("other-registered-component", {
        kind: "registered",
        label: "Other registered library",
        id: "other-lib",
      }),
      createIndexEntry("user-component", {
        kind: "user",
        label: "User",
        id: "user",
      }),
    ]);

    expect(result).toEqual(
      expect.arrayContaining([
        {
          source: {
            kind: "registered",
            label: "Registered libraries",
            id: "registered",
          },
          count: 2,
        },
        {
          source: {
            kind: "user",
            label: "User generated",
            id: "user",
          },
          count: 1,
        },
      ]),
    );
  });
});

describe("filterIndexByDisabledSourceKeys", () => {
  it("removes results from disabled source types", () => {
    const result = filterIndexByDisabledSourceKeys(
      [
        createIndexEntry("registered-component", {
          kind: "registered",
          label: "Registered library",
          id: "registered-lib",
        }),
        createIndexEntry("user-component", {
          kind: "user",
          label: "User",
          id: "user",
        }),
      ],
      ["registered"],
    );

    expect(result.map((entry) => entry.digest)).toEqual(["user-component"]);
  });
});

describe("SourceFilterBar", () => {
  it("toggles source type buttons and exposes active state", () => {
    const onToggle = vi.fn();
    const onEnableAll = vi.fn();

    render(
      <SourceFilterBar
        options={options}
        disabledSourceKeys={["registered"]}
        onToggle={onToggle}
        onEnableAll={onEnableAll}
      />,
    );

    expect(
      screen.getByRole("button", {
        name: "Standard source (2 components)",
      }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("button", {
        name: "Registered libraries source (3 components)",
      }),
    ).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(
      screen.getByRole("button", {
        name: "Registered libraries source (3 components)",
      }),
    );
    expect(onToggle).toHaveBeenCalledWith("registered");

    fireEvent.click(screen.getByRole("button", { name: "Show all" }));
    expect(onEnableAll).toHaveBeenCalledTimes(1);
  });
});

describe("DashboardComponentsV2View", () => {
  beforeEach(() => {
    routeMocks.aiDescriptionsEnabled = false;
    routeMocks.descriptionErrorState.current = null;
    routeMocks.search = {};
    routeMocks.refetchDescription.mockClear();
    routeMocks.rerank.mockClear();
    routeMocks.resetRerank.mockClear();
    routeMocks.aiSearchConfigured = false;
  });

  it("filters visible component results by source type and restores them", () => {
    render(<DashboardComponentsV2View />);

    expect(screen.getByText("Registered component")).toBeInTheDocument();
    expect(screen.getByText("Standard component")).toBeInTheDocument();
    expect(screen.getByText("User component")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Registered libraries source (1 component)",
      }),
    );

    expect(screen.queryByText("Registered component")).not.toBeInTheDocument();
    expect(screen.getByText("Standard component")).toBeInTheDocument();
    expect(screen.getByText("User component")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Show all" }));

    expect(screen.getByText("Registered component")).toBeInTheDocument();
  });

  it("lets AI search run against a bounded candidate pool when literal search has no matches", () => {
    routeMocks.aiSearchConfigured = true;
    render(<DashboardComponentsV2View />);

    fireEvent.change(screen.getByLabelText("Search components"), {
      target: { value: "find something semantically relevant" },
    });
    fireEvent.click(screen.getByRole("button", { name: "AI search" }));

    expect(routeMocks.rerank).toHaveBeenCalledWith({
      query: "find something semantically relevant",
      candidates: expect.arrayContaining([
        expect.objectContaining({ id: "standard-digest" }),
        expect.objectContaining({ id: "registered-digest" }),
        expect.objectContaining({ id: "user-digest" }),
      ]),
      scoreAllCandidates: true,
    });
  });

  it("shows a manual generate button when automatic descriptions are disabled", () => {
    routeMocks.search = { component: "standard-digest" };

    render(<DashboardComponentsV2View />);

    // enabled=false → the hook does not auto-fetch.
    expect(routeMocks.refetchDescription).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole("button", { name: "Generate AI description" }),
    );

    expect(routeMocks.refetchDescription).toHaveBeenCalledWith(
      routeMocks.standard,
    );
  });

  it("generates component descriptions automatically when the flag is enabled", async () => {
    routeMocks.aiDescriptionsEnabled = true;
    routeMocks.search = { component: "standard-digest" };

    render(<DashboardComponentsV2View />);

    // enabled=true → React Query auto-fetches; the mock fires the spy on render.
    await waitFor(() => {
      expect(routeMocks.refetchDescription).toHaveBeenCalledWith(
        routeMocks.standard,
      );
    });
  });

  it("does not automatically retry description generation after an error", () => {
    routeMocks.aiDescriptionsEnabled = true;
    routeMocks.descriptionErrorState.current = new Error("provider failed");
    routeMocks.search = { component: "standard-digest" };

    render(<DashboardComponentsV2View />);

    // With retry: false the errored query stays errored — no auto-refetch.
    expect(routeMocks.refetchDescription).not.toHaveBeenCalled();
    expect(screen.getByText(/provider failed/)).toBeInTheDocument();
  });
});
