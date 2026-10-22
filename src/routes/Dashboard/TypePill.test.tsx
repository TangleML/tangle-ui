import { render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import { getRemotePipelineSavedId } from "@/services/remotePipelineSavedLinks";

import { FavoritesPreview } from "./FavoritesPreview";
import { getFavoriteUrl, getRecentlyViewedUrl, TypePill } from "./TypePill";

vi.mock("@/routes/router", async () => import("@/routes/appRoutes"));
vi.mock("@/components/shared/Settings/useFlags", () => ({
  useProjectsEnabled: () => true,
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, ...props }: ComponentProps<"a"> & { to: string }) => (
    <a href={to} {...props} />
  ),
}));
vi.mock("@/hooks/useFavorites", () => ({
  useFavorites: () => ({
    favorites: [
      {
        type: "pipeline",
        id: "remote:https%3A%2F%2Fexample.com:pipeline/id",
        name: "Saved pipeline",
      },
      { type: "run", id: "run", name: "Run" },
    ],
    removeFavorite: vi.fn(),
  }),
}));

describe("saved pipeline links", () => {
  it("opens backend-qualified favorites and history in the editor", () => {
    const item = {
      type: "pipeline",
      id: getRemotePipelineSavedId("https://example.com", "pipeline/id"),
      name: "Saved pipeline",
    } as const;
    expect(getFavoriteUrl(item)).toBe("/editor/pipeline/pipeline%2Fid");
    expect(getRecentlyViewedUrl(item)).toBe("/editor/pipeline/pipeline%2Fid");
  });

  it("labels a pipeline", () => {
    render(<TypePill type="pipeline" />);
    expect(screen.getByText("Pipeline")).toBeInTheDocument();
  });

  it("shows saved pipelines in the pipeline favorites preview", () => {
    render(
      <TooltipProvider>
        <FavoritesPreview typeFilter="pipeline" />
      </TooltipProvider>,
    );
    expect(
      screen.getByRole("link", { name: /Saved pipeline/ }),
    ).toHaveAttribute("href", "/editor/pipeline/pipeline%2Fid");
    expect(screen.queryByText("Run")).not.toBeInTheDocument();
  });
});
