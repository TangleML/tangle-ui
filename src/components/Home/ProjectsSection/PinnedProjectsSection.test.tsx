import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ProjectSummary } from "@/services/projects/types";

import { PinnedProjectsSection } from "./PinnedProjectsSection";
import { usePinnedProjects } from "./usePinnedProjects";
import { useProjectPin } from "./useProjectPin";

const togglePin = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    params,
  }: {
    children: ReactNode;
    to: string;
    params: { projectId: string };
  }) => <a href={to.replace("$projectId", params.projectId)}>{children}</a>,
}));

vi.mock("./usePinnedProjects", () => ({ usePinnedProjects: vi.fn() }));
vi.mock("./useProjectPin", () => ({ useProjectPin: vi.fn() }));

function project(id: string, name: string): ProjectSummary {
  return {
    id,
    workspaceId: "ws-1",
    name,
    description: null,
    createdBy: "ada@example.com",
    origin: "user",
    createdAt: new Date("2026-09-21T10:00:00Z"),
    updatedAt: new Date("2026-09-21T10:00:00Z"),
    resourceCounts: { pipeline: 2 },
  };
}

function pinned(...projects: ProjectSummary[]) {
  vi.mocked(usePinnedProjects).mockReturnValue({
    projects,
    isPending: false,
  });
}

describe("PinnedProjectsSection", () => {
  beforeEach(() => {
    vi.mocked(useProjectPin).mockReturnValue({ pinned: true, togglePin });
    pinned();
  });
  afterEach(() => vi.resetAllMocks());

  /** An empty section would only take room from the list below it. */
  it("says nothing when nothing is pinned", () => {
    const { container } = render(<PinnedProjectsSection />);

    expect(container).toBeEmptyDOMElement();
  });

  it("links each pinned project to its Tangent page", () => {
    pinned(project("p-1", "Churn model"));

    render(<PinnedProjectsSection />);

    expect(screen.getByRole("link", { name: /Churn model/ })).toHaveAttribute(
      "href",
      "/tangent/p-1",
    );
  });

  it("lists them all", () => {
    pinned(project("p-1", "Churn model"), project("p-2", "MVP workflow"));

    render(<PinnedProjectsSection />);

    expect(screen.getAllByRole("link")).toHaveLength(2);
  });

  /** Unpinning from here is the only way back out of the section. */
  it("unpins from the chip itself", async () => {
    pinned(project("p-1", "Churn model"));
    const user = userEvent.setup();

    render(<PinnedProjectsSection />);
    await user.click(screen.getByRole("button", { name: "Unpin Churn model" }));

    expect(togglePin).toHaveBeenCalled();
  });
});
