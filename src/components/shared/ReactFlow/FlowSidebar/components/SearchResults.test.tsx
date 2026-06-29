import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import type { SearchResult } from "@/types/componentLibrary";
import { ComponentSearchFilter } from "@/utils/constants";

import SearchResults from "./SearchResults";

vi.mock("@/components/shared/Dialogs", () => ({
  ComponentDetailsDialog: () => <button type="button">Details</button>,
}));

vi.mock("@/components/shared/FavoriteComponentToggle", () => ({
  ComponentFavoriteToggle: () => <button type="button">Favorite</button>,
}));

vi.mock(
  "@/components/shared/ManageComponent/hooks/useOutdatedComponents",
  () => ({
    useOutdatedComponents: () => ({ data: [] }),
  }),
);

vi.mock("@/components/shared/Settings/useFlags", () => ({
  useFlagValue: () => false,
}));

vi.mock("@/providers/ComponentLibraryProvider/ForcedSearchProvider", () => ({
  useForcedSearchContext: () => ({
    currentSearchFilter: {
      searchTerm: "scrape",
      filters: [ComponentSearchFilter.NAME],
    },
  }),
}));

vi.mock("../../NodesOverlay/NodesOverlayProvider", () => ({
  useNodesOverlay: () => ({
    notifyNode: vi.fn(),
    getNodeIdsByDigest: vi.fn(() => []),
    fitNodeIntoView: vi.fn(),
  }),
}));

vi.mock("./ComponentHoverPopover", () => ({
  ComponentHoverPopover: ({ children }: { children: ReactNode }) => (
    <>{children}</>
  ),
}));

describe("SearchResults", () => {
  it("shows publisher metadata for v1 component search results", () => {
    const searchResult: SearchResult = {
      components: {
        standard: [
          {
            digest: "published-digest",
            name: "Scrape V2",
            published_by: "pipeline-components@shopify.com",
          },
        ],
        user: [],
        used: [],
      },
    };

    render(
      <SearchResults searchResult={searchResult} onFiltersChange={vi.fn()} />,
    );

    expect(screen.getByText("Scrape V2")).toBeInTheDocument();
    expect(
      screen.getByText("Published by pipeline-components@shopify.com"),
    ).toBeInTheDocument();
  });

  it("shows digest metadata when a v1 component search result has no publisher", () => {
    const searchResult: SearchResult = {
      components: {
        standard: [
          {
            digest: "sha256:abc123",
            name: "Upload to GCS",
          },
        ],
        user: [],
        used: [],
      },
    };

    render(
      <SearchResults searchResult={searchResult} onFiltersChange={vi.fn()} />,
    );

    expect(screen.getByText("Upload to GCS")).toBeInTheDocument();
    expect(screen.getByText("Digest sha256:abc123")).toBeInTheDocument();
  });
});
