import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ComponentSearchV2Content } from "./ComponentSearchV2Content";

const mocks = vi.hoisted(() => ({
  track: vi.fn(),
  useComponentSearchV2State: vi.fn(),
}));

vi.mock(
  "@/components/shared/ReactFlow/FlowSidebar/components/ImportComponent",
  () => ({
    default: ({ triggerComponent }: { triggerComponent: ReactNode }) => (
      <>{triggerComponent}</>
    ),
  }),
);

vi.mock(
  "@/components/shared/ReactFlow/FlowSidebar/components/UpgradeAvailableAlertBox",
  () => ({
    UpgradeAvailableAlertBox: () => (
      <div data-testid="upgrade-available-alert" />
    ),
  }),
);

vi.mock("@/providers/AnalyticsProvider", () => ({
  useAnalytics: () => ({ track: mocks.track }),
}));

vi.mock("@/routes/v2/pages/Editor/hooks/useComponentSearchV2State", () => ({
  useComponentSearchV2State: mocks.useComponentSearchV2State,
}));

vi.mock("./ComponentSearchResults", () => ({
  ComponentSearchResults: ({
    query,
    isSearching,
    showConnectedLibraries,
  }: {
    query: string;
    isSearching: boolean;
    showConnectedLibraries: boolean;
  }) => (
    <div>
      <div data-testid="results-query">{query}</div>
      <div data-testid="results-searching">{String(isSearching)}</div>
      <div data-testid="results-show-connected">
        {String(showConnectedLibraries)}
      </div>
    </div>
  ),
}));

describe("ComponentSearchV2Content", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.track.mockClear();
    mocks.useComponentSearchV2State.mockImplementation(() => ({
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

  it("keeps typing local while delaying result query updates", async () => {
    render(<ComponentSearchV2Content />);

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
    const { container } = render(<ComponentSearchV2Content />);

    const anchor = container.querySelector('[data-tour="library-search"]');
    expect(anchor).not.toBeNull();
    expect(anchor).toContainElement(screen.getByLabelText("Search components"));
  });

  it("shows the upgrades-available alert", () => {
    render(<ComponentSearchV2Content />);

    expect(screen.getByTestId("upgrade-available-alert")).toBeInTheDocument();
  });

  it("rotates visible ranking progress while keeping the spoken status stable", async () => {
    let isReranking = false;
    mocks.useComponentSearchV2State.mockImplementation(() => ({
      results: [],
      browseFolders: [],
      searchSuggestions: [],
      isLoading: false,
      canRerank: true,
      isReranking,
      isRerankActive: false,
      rerank: vi.fn(),
      clearRerank: vi.fn(),
      sourceFilterOptions: [],
      disabledSourceKeys: [],
      toggleSourceFilter: vi.fn(),
      enableAllSources: vi.fn(),
    }));

    const { rerender } = render(<ComponentSearchV2Content />);
    const status = screen.getByRole("status");
    expect(status).toBeEmptyDOMElement();

    isReranking = true;
    rerender(<ComponentSearchV2Content />);
    expect(status).toHaveTextContent("Ranking component search results.");
    expect(
      screen.getByText("Scanning component candidates with AI…"),
    ).toHaveAttribute("aria-hidden", "true");

    await act(async () => {
      vi.advanceTimersByTime(1200);
    });

    expect(
      screen.getByText("Comparing component candidates with AI…"),
    ).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByRole("status")).toBe(status);
    expect(status).toHaveTextContent("Ranking component search results.");

    isReranking = false;
    rerender(<ComponentSearchV2Content />);
    expect(status).toBeEmptyDOMElement();
  });

  it("shows source filters and toggles them from editor search", () => {
    const toggleSourceFilter = vi.fn();
    const enableAllSources = vi.fn();
    mocks.useComponentSearchV2State.mockImplementation(() => ({
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

    render(<ComponentSearchV2Content />);

    fireEvent.click(
      screen.getByRole("button", {
        name: "User generated source (1 component)",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Show all" }));

    expect(toggleSourceFilter).toHaveBeenCalledWith("user");
    expect(enableAllSources).toHaveBeenCalled();
  });

  it("hides connected libraries when the registered source is disabled", () => {
    const { unmount } = render(<ComponentSearchV2Content />);
    expect(screen.getByTestId("results-show-connected")).toHaveTextContent(
      "true",
    );
    unmount();

    mocks.useComponentSearchV2State.mockImplementation(() => ({
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
      disabledSourceKeys: ["registered"],
      toggleSourceFilter: vi.fn(),
      enableAllSources: vi.fn(),
    }));

    render(<ComponentSearchV2Content />);
    expect(screen.getByTestId("results-show-connected")).toHaveTextContent(
      "false",
    );
  });

  it("tracks editor component search completions without query text", async () => {
    render(<ComponentSearchV2Content />);

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
