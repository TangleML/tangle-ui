import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ComponentSearchContent } from "./ComponentSearchContent";

const mocks = vi.hoisted(() => ({
  track: vi.fn(),
  useComponentSearchState: vi.fn(),
  usedComponentsFolder: {
    name: "Used in Pipeline",
    components: [{ digest: "used" }],
  },
  favoritesFolder: {
    name: "Favorite Components",
    components: [{ digest: "favorite" }],
  },
  resultsProps: vi.fn(),
}));

vi.mock("@/providers/ComponentLibraryProvider", () => ({
  useComponentLibrary: () => mocks,
}));

vi.mock("@/components/shared/Settings/useFlags", () => ({
  useFlagValue: (flag: string) => flag === "input-aggregator",
}));

vi.mock(
  "@/components/shared/ReactFlow/FlowSidebar/components/UpgradeAvailableAlertBox",
  () => ({
    UpgradeAvailableAlertBox: () => <div>Component upgrades</div>,
  }),
);

vi.mock(
  "@/components/shared/ReactFlow/FlowSidebar/components/ImportComponent",
  () => ({
    default: ({ triggerComponent }: { triggerComponent: ReactNode }) => (
      <>{triggerComponent}</>
    ),
  }),
);

vi.mock("@/providers/AnalyticsProvider", () => ({
  useAnalytics: () => ({ track: mocks.track }),
}));

vi.mock("@/routes/v2/pages/Editor/hooks/useComponentSearchState", () => ({
  useComponentSearchState: mocks.useComponentSearchState,
}));

vi.mock("./ComponentSearchResults", () => ({
  ComponentSearchResults: (props: { query: string; isSearching: boolean }) => {
    mocks.resultsProps(props);
    return (
      <div>
        <div data-testid="results-query">{props.query}</div>
        <div data-testid="results-searching">{String(props.isSearching)}</div>
      </div>
    );
  },
}));

describe("ComponentSearchContent", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.track.mockClear();
    mocks.useComponentSearchState.mockImplementation(() => ({
      results: [],
      browseFolders: [],
      searchSuggestions: [],
      isLoading: false,
      canRerank: false,
      isReranking: false,
      isRerankActive: false,
      rerank: vi.fn(),
      clearRerank: vi.fn(),
      sourceFilterOptions: [],
      disabledSourceKeys: [],
      toggleSourceFilter: vi.fn(),
      enableAllSources: vi.fn(),
    }));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("retains pipeline components, favorites, the aggregator and upgrade review", () => {
    render(<ComponentSearchContent />);

    expect(mocks.resultsProps).toHaveBeenLastCalledWith(
      expect.objectContaining({
        usedComponentsFolder: mocks.usedComponentsFolder,
        favoritesFolder: mocks.favoritesFolder,
        inputAggregatorEnabled: true,
      }),
    );
    expect(screen.getByText("Component upgrades")).toBeInTheDocument();
  });

  it("keeps typing local while delaying result query updates", async () => {
    render(<ComponentSearchContent />);

    const input = screen.getByLabelText("Search components");

    fireEvent.change(input, { target: { value: "csv" } });

    expect(input).toHaveValue("csv");
    expect(screen.getByTestId("results-query")).toHaveTextContent("");
    expect(screen.getByTestId("results-searching")).toHaveTextContent("true");

    await act(async () => {
      vi.advanceTimersByTime(499);
    });

    expect(screen.getByTestId("results-query")).toHaveTextContent("");

    await act(async () => {
      vi.advanceTimersByTime(1);
    });

    expect(screen.getByTestId("results-query")).toHaveTextContent("csv");
    expect(screen.getByTestId("results-searching")).toHaveTextContent("false");
  });

  it("anchors the guided-tour library-search step to the search box", () => {
    const { container } = render(<ComponentSearchContent />);

    const anchor = container.querySelector('[data-tour="library-search"]');
    expect(anchor).not.toBeNull();
    expect(anchor).toContainElement(screen.getByLabelText("Search components"));
  });

  it("shows active AI rerank progress below the search box", async () => {
    mocks.useComponentSearchState.mockImplementation(() => ({
      results: [],
      browseFolders: [],
      searchSuggestions: [],
      isLoading: false,
      canRerank: true,
      isReranking: true,
      isRerankActive: false,
      rerank: vi.fn(),
      clearRerank: vi.fn(),
      sourceFilterOptions: [],
      disabledSourceKeys: [],
      toggleSourceFilter: vi.fn(),
      enableAllSources: vi.fn(),
    }));

    render(<ComponentSearchContent />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "Scanning component candidates with AI…",
    );

    await act(async () => {
      vi.advanceTimersByTime(1200);
    });

    expect(screen.getByRole("status")).toHaveTextContent(
      "Comparing component candidates with AI…",
    );
  });

  it("shows source filters and toggles them from editor search", () => {
    const toggleSourceFilter = vi.fn();
    const enableAllSources = vi.fn();
    mocks.useComponentSearchState.mockImplementation(() => ({
      results: [],
      browseFolders: [],
      searchSuggestions: [],
      isLoading: false,
      canRerank: false,
      isReranking: false,
      isRerankActive: false,
      rerank: vi.fn(),
      clearRerank: vi.fn(),
      sourceFilterOptions: [
        {
          source: { kind: "standard", id: "standard", label: "Standard" },
          count: 2,
        },
        {
          source: { kind: "user", id: "user", label: "User generated" },
          count: 1,
        },
      ],
      disabledSourceKeys: ["user"],
      toggleSourceFilter,
      enableAllSources,
    }));

    render(<ComponentSearchContent />);

    fireEvent.click(
      screen.getByRole("button", {
        name: "User generated source (1 component)",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Show all" }));

    expect(toggleSourceFilter).toHaveBeenCalledWith("user");
    expect(enableAllSources).toHaveBeenCalled();
  });

  it("tracks editor component search completions without query text", async () => {
    render(<ComponentSearchContent />);

    fireEvent.change(screen.getByLabelText("Search components"), {
      target: { value: "csv" },
    });

    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    await act(async () => {
      vi.advanceTimersByTime(400);
    });

    expect(mocks.track).toHaveBeenCalledWith(
      "component_library.search.completed",
      expect.objectContaining({
        surface: "editor_component_search_v2",
        search_backend: "frontend_aggregate",
        query_length: "csv".length,
        result_count: 0,
        ai_ranked: false,
      }),
    );
    expect(mocks.track).not.toHaveBeenCalledWith(
      "component_library.search.completed",
      expect.objectContaining({ query: "csv" }),
    );
  });
});
