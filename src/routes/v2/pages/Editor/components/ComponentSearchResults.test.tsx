import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ComponentSearchSuggestion } from "@/services/componentSearchSuggestions";

import { ComponentSearchResults } from "./ComponentSearchResults";
import type { ComponentSearchV2Result } from "./componentSearchV2Logic";

vi.mock(
  "@/components/shared/ReactFlow/FlowSidebar/components/ComponentItem",
  () => ({
    ComponentMarkup: ({
      component,
      matchedFields,
    }: {
      component: { name?: string };
      matchedFields?: string[];
    }) => (
      <li>
        {component.name}
        {matchedFields && <span>matched {matchedFields.join(",")}</span>}
      </li>
    ),
    IONodeSidebarItem: () => <li>IO node</li>,
    StickyNoteSidebarItem: () => <li>Sticky note</li>,
  }),
);

vi.mock(
  "@/components/shared/ReactFlow/FlowSidebar/components/FolderItem",
  () => ({
    default: ({ folder }: { folder: { name: string } }) => (
      <div>{folder.name}</div>
    ),
  }),
);

const baseProps = {
  browseFolders: [],
  searchSuggestions: [
    { label: "csv", kind: "default" },
    { label: "dataset", kind: "type" },
  ] satisfies ComponentSearchSuggestion[],
  isLoading: false,
  isRerankActive: false,
  onClearRerank: vi.fn(),
  onSuggestedSearch: vi.fn(),
};

describe("ComponentSearchResults", () => {
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

  it("passes matched fields through for result explanations", () => {
    const results: ComponentSearchV2Result[] = [
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
