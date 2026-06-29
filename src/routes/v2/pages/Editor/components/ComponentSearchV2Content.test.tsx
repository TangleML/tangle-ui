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
  }: {
    query: string;
    isSearching: boolean;
  }) => (
    <div>
      <div data-testid="results-query">{query}</div>
      <div data-testid="results-searching">{String(isSearching)}</div>
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

  it("shows active AI rerank progress below the search box", async () => {
    mocks.useComponentSearchV2State.mockImplementation(() => ({
      results: [],
      browseFolders: [],
      searchSuggestions: [],
      isLoading: false,
      canRerank: true,
      isReranking: true,
      isRerankActive: false,
      rerank: vi.fn(),
      clearRerank: vi.fn(),
    }));

    render(<ComponentSearchV2Content />);

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
