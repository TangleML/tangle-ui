import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { StoredLibrary } from "@/providers/ComponentLibraryProvider/libraries/storage";
import type { IndexEntry } from "@/services/componentSearchIndex";
import type { ComponentReference } from "@/utils/componentSpec";

interface DashboardComponentsV2Search {
  component?: string;
  q?: string;
  disabled_sources?: string;
}

const routeMocks = vi.hoisted(() => {
  const makeComponent = (digest: string, name: string): ComponentReference => ({
    digest,
    name,
    text: "component yaml",
    spec: {
      name,
      description: `${name} description`,
      inputs:
        digest === "registered-digest"
          ? [{ name: "data", type: "Dataset" }]
          : [],
      outputs:
        digest === "standard-digest" ? [{ name: "data", type: "Dataset" }] : [],
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
    aiApiBase: "",
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

vi.mock("@/hooks/useAiProviderSettings", () => ({
  useAiProviderSettings: () => ({
    config: { apiBase: routeMocks.aiApiBase, apiKey: "" },
  }),
}));

vi.mock("@/services/componentSearchEmbeddings", () => ({
  rankComponentMatchesByEmbeddings: vi.fn(async (index: IndexEntry[]) =>
    index.length > 0
      ? [
          {
            reference: index[0].reference,
            digest: index[0].digest,
            name: index[0].name,
            source: index[0].source,
            matchedFields: [],
          },
        ]
      : [],
  ),
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
  buildComponentCollectionMatches,
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

describe("buildComponentCollectionMatches", () => {
  it("returns registered library collections matching the query", () => {
    const result = buildComponentCollectionMatches(
      [
        createIndexEntry("standard-component", {
          kind: "standard",
          label: "Standard",
          id: "standard",
        }),
        createIndexEntry("load-csv", {
          kind: "registered",
          label: "Data tools",
          id: "data-tools",
        }),
        createIndexEntry("clean-data", {
          kind: "registered",
          label: "Data tools",
          id: "data-tools",
        }),
      ],
      "data",
    );

    expect(result).toEqual([
      {
        id: "data-tools",
        label: "Data tools",
        count: 2,
        previewNames: ["load-csv", "clean-data"],
      },
    ]);
  });

  it("returns no collections for empty or unmatched queries", () => {
    const index = [
      createIndexEntry("load-csv", {
        kind: "registered",
        label: "Data tools",
        id: "data-tools",
      }),
    ];

    expect(buildComponentCollectionMatches(index, "")).toEqual([]);
    expect(buildComponentCollectionMatches(index, "training")).toEqual([]);
  });
});

describe("DashboardComponentsV2View", () => {
  beforeEach(() => {
    routeMocks.aiDescriptionsEnabled = false;
    routeMocks.descriptionErrorState.current = null;
    routeMocks.search = {};
    routeMocks.standard.deprecated = false;
    routeMocks.standard.superseded_by = undefined;
    routeMocks.navigate.mockClear();
    routeMocks.notify.mockClear();
    routeMocks.refetchDescription.mockClear();
    routeMocks.rerank.mockClear();
    routeMocks.resetRerank.mockClear();
    routeMocks.aiSearchConfigured = false;
    routeMocks.aiApiBase = "";
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
    expect(routeMocks.navigate).toHaveBeenLastCalledWith({
      to: "/dashboard/components-v2",
      search: { disabled_sources: "registered" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Show all" }));

    expect(screen.getByText("Registered component")).toBeInTheDocument();
    expect(routeMocks.navigate).toHaveBeenLastCalledWith({
      to: "/dashboard/components-v2",
      search: {},
    });
  });

  it("shows registered library collection results when the query matches", async () => {
    render(<DashboardComponentsV2View />);

    fireEvent.change(screen.getByLabelText("Search components"), {
      target: { value: "github" },
    });

    await waitFor(() => {
      expect(screen.getByText("GitHub library")).toBeInTheDocument();
    });
  });

  it("hides collection results from disabled sources", async () => {
    render(<DashboardComponentsV2View />);

    fireEvent.click(
      screen.getByRole("button", {
        name: "Registered libraries source (1 component)",
      }),
    );
    fireEvent.change(screen.getByLabelText("Search components"), {
      target: { value: "github" },
    });

    await waitFor(() => {
      expect(screen.queryByText("GitHub library")).not.toBeInTheDocument();
    });
  });

  it("explains why lexical component results matched", async () => {
    render(<DashboardComponentsV2View />);

    fireEvent.change(screen.getByLabelText("Search components"), {
      target: { value: "standard" },
    });

    await waitFor(() => {
      expect(screen.getByText(/Why: Matched/)).toBeInTheDocument();
    });
  });

  it("shows actionable no-results guidance", async () => {
    render(<DashboardComponentsV2View />);

    fireEvent.change(screen.getByLabelText("Search components"), {
      target: { value: "no-such-component" },
    });

    await waitFor(() => {
      expect(
        screen.getByText("No components matched “no-such-component”."),
      ).toBeInTheDocument();
    });
    expect(screen.getByText(/Try a component name/)).toBeInTheDocument();
  });

  it("initializes search state from URL params", () => {
    routeMocks.search = {
      q: "registered",
      disabled_sources: "standard,user",
    };

    render(<DashboardComponentsV2View />);

    expect(screen.getByLabelText("Search components")).toHaveValue(
      "registered",
    );
    expect(screen.getByText("Registered component")).toBeInTheDocument();
    expect(screen.queryByText("Standard component")).not.toBeInTheDocument();
    expect(screen.queryByText("User component")).not.toBeInTheDocument();
  });

  it("writes search text into URL params after debounce without trimming active input whitespace", async () => {
    render(<DashboardComponentsV2View />);

    fireEvent.change(screen.getByLabelText("Search components"), {
      target: { value: "standard " },
    });

    await waitFor(() => {
      expect(routeMocks.navigate).toHaveBeenCalledWith({
        to: "/dashboard/components-v2",
        search: { q: "standard " },
      });
    });
    expect(screen.getByLabelText("Search components")).toHaveValue("standard ");
  });

  it("does not let URL echo updates rewrite the focused search input", async () => {
    const { rerender } = render(<DashboardComponentsV2View />);
    const input = screen.getByLabelText("Search components");

    input.focus();
    fireEvent.change(input, { target: { value: "standard " } });

    await waitFor(() => {
      expect(routeMocks.navigate).toHaveBeenCalled();
    });

    routeMocks.search = { q: "standard" };
    rerender(<DashboardComponentsV2View />);

    expect(input).toHaveValue("standard ");
  });

  it("copies a shareable link for a selected component", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    routeMocks.search = { component: "standard-digest", q: "standard" };

    render(<DashboardComponentsV2View />);

    fireEvent.click(
      screen.getByRole("button", { name: "Copy component link" }),
    );

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(window.location.href);
    });
    expect(routeMocks.notify).toHaveBeenCalledWith(
      "Component link copied to clipboard",
      "success",
    );
  });

  it("shows compatible component suggestions in details", () => {
    routeMocks.search = { component: "standard-digest" };

    render(<DashboardComponentsV2View />);

    expect(screen.getByText("Compatible components")).toBeInTheDocument();
    expect(screen.getAllByText("Registered component")).not.toHaveLength(0);
    expect(screen.getByText("Can use outputs")).toBeInTheDocument();
    expect(screen.getByText("Matching type: dataset")).toBeInTheDocument();
  });

  it("clears only the selected component when closing details", () => {
    routeMocks.search = {
      component: "standard-digest",
      q: "standard",
      disabled_sources: "registered",
    };

    render(<DashboardComponentsV2View />);

    fireEvent.click(
      screen.getByRole("button", { name: "Close component details" }),
    );

    expect(routeMocks.navigate).toHaveBeenCalledWith({
      to: "/dashboard/components-v2",
      search: { q: "standard", disabled_sources: "registered" },
    });
  });

  it("shows lifecycle badges from component metadata", () => {
    routeMocks.standard.deprecated = true;

    render(<DashboardComponentsV2View />);

    expect(screen.getByText("Deprecated")).toBeInTheDocument();
  });

  it("does not run AI search when literal search has no matches", async () => {
    routeMocks.aiSearchConfigured = true;
    render(<DashboardComponentsV2View />);

    fireEvent.change(screen.getByLabelText("Search components"), {
      target: { value: "find something semantically relevant" },
    });
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "AI search" })).toBeDisabled();
    });
    fireEvent.click(screen.getByRole("button", { name: "AI search" }));

    expect(routeMocks.rerank).not.toHaveBeenCalled();
  });

  it("allows AI search with embeddings when literal search has no matches", async () => {
    routeMocks.aiSearchConfigured = true;
    routeMocks.aiApiBase = "https://api.example.com/v1";
    render(<DashboardComponentsV2View />);

    fireEvent.change(screen.getByLabelText("Search components"), {
      target: { value: "find something semantically relevant" },
    });
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "AI search" })).toBeEnabled();
    });
    fireEvent.click(screen.getByRole("button", { name: "AI search" }));

    await waitFor(() => expect(routeMocks.rerank).toHaveBeenCalled());
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
