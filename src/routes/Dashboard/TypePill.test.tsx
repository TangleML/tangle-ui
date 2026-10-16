import { render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { isFlagEnabled } from "@/components/shared/Settings/useFlags";
import { TooltipProvider } from "@/components/ui/tooltip";

import { FavoritesPreview } from "./FavoritesPreview";
import { getFavoriteUrl, getRecentlyViewedUrl, TypePill } from "./TypePill";

vi.mock("@/components/shared/Settings/useFlags", () => ({
  isFlagEnabled: vi.fn(),
  useProjectsEnabled: () => true,
}));
vi.mock("@/routes/router", async () => import("@/routes/appRoutes"));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, ...props }: ComponentProps<"a"> & { to: string }) => (
    <a href={to} {...props} />
  ),
}));
vi.mock("@/hooks/useFavorites", () => ({
  useFavorites: () => ({
    favorites: [
      { type: "pipeline", id: "local", name: "Local pipeline" },
      { type: "remote-pipeline", id: "remote/id", name: "Uploaded pipeline" },
      {
        type: "pipeline",
        id: "remote:https%3A%2F%2Fexample.com:legacy-id",
        name: "Previously uploaded pipeline",
      },
      { type: "run", id: "run", name: "Run" },
    ],
    removeFavorite: vi.fn(),
  }),
}));

beforeEach(() => vi.mocked(isFlagEnabled).mockReset());

describe("saved pipeline links", () => {
  it.each([false, true])(
    "opens remote favorites and history in the selected editor (v2: %s)",
    (v2) => {
      vi.mocked(isFlagEnabled).mockReturnValue(v2);
      const item = {
        type: "remote-pipeline",
        id: "remote/id",
        name: "Pipeline",
        timestamp: 1,
      } as const;
      const editor = v2 ? "/editor-v2" : "/editor";
      expect(getFavoriteUrl(item)).toBe(`${editor}/pipeline/remote%2Fid`);
      expect(getRecentlyViewedUrl(item)).toBe(`${editor}/pipeline/remote%2Fid`);
      const local = { ...item, type: "pipeline" } as const;
      expect(getFavoriteUrl(local)).toBe(`${editor}/remote%2Fid`);
      expect(getRecentlyViewedUrl(local)).toBe(`${editor}/remote%2Fid`);
    },
  );

  it("renders migrated entries with the pipeline label", () => {
    render(<TypePill type="remote-pipeline" />);
    expect(screen.getByText("Pipeline")).toBeInTheDocument();
  });

  it.each([false, true])(
    "opens existing encoded remote favorites and history (v2: %s)",
    (v2) => {
      vi.mocked(isFlagEnabled).mockReturnValue(v2);
      const item = {
        type: "pipeline",
        id: "remote:https%3A%2F%2Fexample.com:legacy-id",
        name: "Previously uploaded pipeline",
        timestamp: 1,
      } as const;
      const editor = v2 ? "/editor-v2" : "/editor";

      expect(getFavoriteUrl(item)).toBe(`${editor}/pipeline/legacy-id`);
      expect(getRecentlyViewedUrl(item)).toBe(`${editor}/pipeline/legacy-id`);
      render(<TypePill type={item.type} id={item.id} />);
      expect(screen.getByText("Pipeline")).toBeInTheDocument();
    },
  );

  it.each([
    "remote:notes",
    "remote:%invalid:id",
    "remote:notes:id",
    "remote:https%3A%2F%2Fexample.com:",
    "remote:file%3A%2F%2Fexample.com:id",
  ])(
    "preserves a local pipeline name that resembles a remote key: %s",
    (id) => {
      vi.mocked(isFlagEnabled).mockReturnValue(true);
      const item = { type: "pipeline", id, name: id, timestamp: 1 } as const;
      const path = `/editor-v2/${encodeURIComponent(id)}`;

      expect(getFavoriteUrl(item)).toBe(path);
      expect(getRecentlyViewedUrl(item)).toBe(path);
      render(<TypePill type={item.type} id={item.id} />);
      expect(screen.getByText("Pipeline")).toBeInTheDocument();
    },
  );

  it("keeps uploaded favorites in the pipeline preview with a remote link", () => {
    vi.mocked(isFlagEnabled).mockReturnValue(true);
    render(
      <TooltipProvider>
        <FavoritesPreview typeFilter="pipeline" />
      </TooltipProvider>,
    );

    expect(
      screen.getByRole("link", { name: /Uploaded pipeline/ }),
    ).toHaveAttribute("href", "/editor-v2/pipeline/remote%2Fid");
    expect(
      screen.getByRole("link", { name: /Local pipeline/ }),
    ).toHaveAttribute("href", "/editor-v2/local");
    expect(
      screen.getByRole("link", { name: /Previously uploaded pipeline/ }),
    ).toHaveAttribute("href", "/editor-v2/pipeline/legacy-id");
    expect(screen.queryByText("Run")).not.toBeInTheDocument();
  });
});
