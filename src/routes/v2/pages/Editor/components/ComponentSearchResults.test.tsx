import { fireEvent, render, screen } from "@testing-library/react";
import { isValidElement } from "react";
import { describe, expect, it, vi } from "vitest";

import type { ComponentSearchResult } from "@/services/componentSearchLogic";
import type { ComponentSearchSuggestion } from "@/services/componentSearchSuggestions";
import type { UIComponentFolder } from "@/types/componentLibrary";

import { ComponentSearchResults } from "./ComponentSearchResults";

vi.mock(
  "@/components/shared/ReactFlow/FlowSidebar/components/ComponentItem",
  () => ({
    ComponentMarkup: ({
      component,
      matchedFields,
      source,
    }: {
      component: { name?: string };
      matchedFields?: string[];
      source?: { label: string };
    }) => (
      <li>
        {component.name}
        {matchedFields && <span>matched {matchedFields.join(",")}</span>}
        {source && <span>source {source.label}</span>}
      </li>
    ),
    IONodeSidebarItem: () => <li>IO node</li>,
    StickyNoteSidebarItem: () => <li>Sticky note</li>,
    ComponentItemFromUrl: () => <li>Input Aggregator</li>,
  }),
);

vi.mock(
  "@/components/shared/ReactFlow/FlowSidebar/components/FolderItem",
  () => ({
    default: ({ folder }: { folder: UIComponentFolder }) => (
      <div>
        {folder.name}
        <ul>{folder.components?.filter(isValidElement)}</ul>
      </div>
    ),
  }),
);

vi.mock("@/components/shared/GitHubLibrary/ManageLibrariesDialog", () => ({
  ManageLibrariesDialog: () => <button>Manage libraries</button>,
}));

const baseProps = {
  browseFolders: [],
  searchSuggestions: [
    { label: "csv", kind: "default" },
    { label: "dataset", kind: "type" },
  ] satisfies ComponentSearchSuggestion[],
  isLoading: false,
  isSearching: false,
  isRerankActive: false,
  onClearRerank: vi.fn(),
  onSuggestedSearch: vi.fn(),
};

describe("ComponentSearchResults", () => {
  it("keeps the existing editor library capabilities in browse mode", () => {
    render(
      <ComponentSearchResults
        {...baseProps}
        query=""
        results={[]}
        usedComponentsFolder={{
          name: "Used in Pipeline",
          components: [{ digest: "used" }],
        }}
        favoritesFolder={{
          name: "Favorite Components",
          components: [{ digest: "favorite" }],
        }}
        inputAggregatorEnabled
      />,
    );

    expect(screen.getByText("Used in Pipeline")).toBeInTheDocument();
    expect(screen.getByText("Favorite Components")).toBeInTheDocument();
    expect(screen.getByText("Input Aggregator")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Manage libraries" }),
    ).toBeInTheDocument();
  });

  it("shows a skeleton while search is pending", () => {
    render(
      <ComponentSearchResults
        {...baseProps}
        query="csv"
        results={[]}
        isSearching
      />,
    );

    expect(screen.getByTestId("search-results-skeleton")).toHaveAttribute(
      "aria-label",
      "Loading search results",
    );
    expect(
      screen.getAllByTestId("component-result-title-skeleton"),
    ).toHaveLength(5);
    expect(screen.getAllByTestId("component-result-why-skeleton")).toHaveLength(
      5,
    );
    expect(screen.queryByText("Why:")).not.toBeInTheDocument();
    expect(screen.queryByText("Searching")).not.toBeInTheDocument();
  });

  it("browses immediately for an empty query even while sources are loading", () => {
    render(
      <ComponentSearchResults
        {...baseProps}
        query=""
        results={[]}
        browseFolders={[{ name: "Standard library" }]}
        isLoading
        isSearching
      />,
    );

    expect(
      screen.queryByTestId("search-results-skeleton"),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("search-results-container")).toBeInTheDocument();
    expect(screen.getByText("Standard library")).toBeInTheDocument();
  });

  it("shows actionable no-results guidance with clickable suggestions", () => {
    const onSuggestedSearch = vi.fn();
    render(
      <ComponentSearchResults
        {...baseProps}
        query="missing"
        results={[]}
        onSuggestedSearch={onSuggestedSearch}
      />,
    );

    expect(
      screen.getByText("No components matched “missing”."),
    ).toBeInTheDocument();
    expect(screen.getByText(/Try a component name/)).toBeInTheDocument();

    const suggestion = screen.getByRole("button", { name: "csv" });

    expect(suggestion).toHaveAttribute(
      "data-tracking-id",
      "component_library.search.suggestion",
    );
    expect(suggestion).toHaveAttribute(
      "data-tracking-metadata",
      JSON.stringify({
        surface: "editor_component_search_v2",
        suggestion_kind: "default",
        suggestion_position: 0,
      }),
    );

    fireEvent.click(suggestion);

    expect(onSuggestedSearch).toHaveBeenCalledWith("csv");
  });

  it("passes source metadata through for result display", () => {
    const results: ComponentSearchResult[] = [
      {
        reference: {
          digest: "digest",
          name: "Load CSV",
          published_by: "pipeline-components@example.com",
        },
        source: { kind: "published", id: "published", label: "Published" },
      },
    ];

    render(
      <ComponentSearchResults {...baseProps} query="csv" results={results} />,
    );

    expect(screen.getByText("source Published")).toBeInTheDocument();
  });

  it("renders matches in a vertically scrollable list", () => {
    const results: ComponentSearchResult[] = [
      {
        reference: { digest: "digest", name: "Load CSV" },
        source: { kind: "standard", id: "standard", label: "Standard" },
      },
    ];

    render(
      <ComponentSearchResults {...baseProps} query="csv" results={results} />,
    );

    expect(screen.getByTestId("search-results-list")).toHaveClass(
      "overflow-y-auto",
    );
  });

  it("shows large result sets progressively", () => {
    const results: ComponentSearchResult[] = Array.from(
      { length: 25 },
      (_, index) => ({
        reference: { digest: `digest-${index}`, name: `Component ${index}` },
        source: { kind: "standard", id: "standard", label: "Standard" },
      }),
    );

    render(
      <ComponentSearchResults
        {...baseProps}
        query="component"
        results={results}
      />,
    );

    expect(screen.getByTestId("search-results-header")).toHaveTextContent(
      "Search Results (10 of 25)",
    );
    expect(screen.getAllByRole("listitem")).toHaveLength(10);

    const showMoreButton = screen.getByRole("button", {
      name: "Show 10 more",
    });
    expect(showMoreButton).toHaveAttribute(
      "data-tracking-id",
      "component_library.search.show_more",
    );
    expect(showMoreButton).toHaveAttribute(
      "data-tracking-metadata",
      JSON.stringify({
        surface: "editor_component_search_v2",
        shown_count: 10,
        result_count: 25,
        ai_ranked: false,
      }),
    );

    fireEvent.click(showMoreButton);

    expect(screen.getByTestId("search-results-header")).toHaveTextContent(
      "Search Results (20 of 25)",
    );
    expect(screen.getAllByRole("listitem")).toHaveLength(20);

    fireEvent.click(screen.getByRole("button", { name: "Show 5 more" }));

    expect(screen.getByTestId("search-results-header")).toHaveTextContent(
      "Search Results (25)",
    );
    expect(screen.getAllByRole("listitem")).toHaveLength(25);
    expect(
      screen.queryByRole("button", { name: /Show .* more/ }),
    ).not.toBeInTheDocument();
  });

  it("passes matched fields through for result explanations", () => {
    const results: ComponentSearchResult[] = [
      {
        reference: { digest: "digest", name: "Load CSV" },
        source: { kind: "standard", id: "standard", label: "Standard" },
        matchedFields: ["name", "io"],
      },
    ];

    render(
      <ComponentSearchResults {...baseProps} query="csv" results={results} />,
    );

    expect(screen.getByText("matched name,io")).toBeInTheDocument();
  });
});
