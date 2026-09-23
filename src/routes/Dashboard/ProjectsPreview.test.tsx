import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useMyProjects } from "@/components/Home/ProjectsSection/useMyProjects";
import { useFlagValue } from "@/components/shared/Settings/useFlags";
import { useBackend } from "@/providers/BackendProvider";
import type { ProjectSummary } from "@/services/projects/types";

import { ProjectsPreview } from "./ProjectsPreview";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children }: { to: string; children: ReactNode }) => (
    <a href={to}>{children}</a>
  ),
}));

vi.mock("@/components/shared/Settings/useFlags", () => ({
  useFlagValue: vi.fn(),
}));

vi.mock("@/providers/BackendProvider", () => ({ useBackend: vi.fn() }));

vi.mock("@/components/Home/ProjectsSection/useMyProjects", () => ({
  useMyProjects: vi.fn(),
}));

vi.mock("@/components/Home/ProjectsSection/ProjectCard", () => ({
  ProjectCard: ({ project }: { project: ProjectSummary }) => (
    <div data-testid="project-card">{project.name}</div>
  ),
}));

function project(id: string): ProjectSummary {
  return {
    id,
    workspaceId: "ws-1",
    name: `Project ${id}`,
    description: null,
    createdBy: null,
    origin: "user",
    createdAt: new Date("2026-09-22T10:00:00Z"),
    updatedAt: new Date("2026-09-22T10:00:00Z"),
    resourceCounts: {},
  };
}

function given(...projects: ProjectSummary[]) {
  vi.mocked(useMyProjects).mockReturnValue({
    projects,
    createdBy: "ada@example.com",
    totalCount: projects.length,
    isPending: false,
    error: null,
    hasMore: false,
    isLoadingMore: false,
    loadMore: vi.fn(),
  });
}

describe("ProjectsPreview", () => {
  beforeEach(() => {
    vi.mocked(useFlagValue).mockReturnValue(true);
    vi.mocked(useBackend).mockReturnValue({
      configured: true,
      available: true,
    } as unknown as ReturnType<typeof useBackend>);
    given();
  });
  afterEach(() => vi.resetAllMocks());

  it("shows the projects the user has", () => {
    given(project("a"), project("b"));

    render(<ProjectsPreview />);

    expect(screen.getAllByTestId("project-card")).toHaveLength(2);
  });

  it("leads to the full list", () => {
    given(project("a"));

    render(<ProjectsPreview />);

    expect(
      screen.getByRole("link", { name: "View all projects →" }),
    ).toHaveAttribute("href", "/projects");
  });

  /**
   * The row is clipped to one line, so anything past a screenful is invisible
   * however wide the window is — rendering all of them is only weight.
   */
  it("renders no more than a wide screen could show", () => {
    given(...Array.from({ length: 30 }, (_, index) => project(String(index))));

    render(<ProjectsPreview />);

    expect(screen.getAllByTestId("project-card")).toHaveLength(8);
  });

  it("invites a user with no projects rather than showing an empty row", () => {
    render(<ProjectsPreview />);

    expect(
      screen.getByText("No projects yet — start a session to make one."),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("project-card")).toBeNull();
  });

  it("says nothing at all when projects are turned off", () => {
    vi.mocked(useFlagValue).mockReturnValue(false);
    given(project("a"));

    const { container } = render(<ProjectsPreview />);

    expect(container).toBeEmptyDOMElement();
  });

  /** The runs section below already reports an unreachable backend. */
  it("stays out of the way when the backend cannot answer", () => {
    vi.mocked(useBackend).mockReturnValue({
      configured: true,
      available: false,
    } as unknown as ReturnType<typeof useBackend>);

    const { container } = render(<ProjectsPreview />);

    expect(container).toBeEmptyDOMElement();
  });
});
