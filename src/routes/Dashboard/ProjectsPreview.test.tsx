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

vi.mock("@/components/shared/Settings/useFlags", () => {
  const useFlagValue = vi.fn();
  return {
    useFlagValue,
    useProjectsEnabled: () => useFlagValue("projects"),
    useTangentEnabled: () => useFlagValue("tangent-shell"),
  };
});

vi.mock("@/providers/BackendProvider", () => ({ useBackend: vi.fn() }));

vi.mock("@/components/Home/ProjectsSection/useMyProjects", () => ({
  useMyProjects: vi.fn(),
}));

vi.mock("@/components/Home/ProjectsSection/ProjectRow", () => ({
  ProjectRow: ({ project }: { project: ProjectSummary }) => (
    <div data-testid="project-row">{project.name}</div>
  ),
}));

const widgetProps = {
  section: { id: "projects", type: "projects" as const, width: 3 as const },
  editing: false,
  first: true,
  last: true,
  onChange: vi.fn(),
  onRemove: vi.fn(),
  onMove: vi.fn(),
};

function project(id: string): ProjectSummary {
  return {
    id,
    workspaceId: "ws-1",
    name: `Project ${id}`,
    description: null,
    createdBy: null,
    origin: "user",
    metadata: null,
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

    render(<ProjectsPreview {...widgetProps} />);

    expect(screen.getAllByTestId("project-row")).toHaveLength(2);
  });

  it("leads to the full list", () => {
    given(project("a"));

    render(<ProjectsPreview {...widgetProps} />);

    expect(screen.getByRole("link", { name: "View all →" })).toHaveAttribute(
      "href",
      "/projects",
    );
  });

  it("limits the preview to five projects", () => {
    given(...Array.from({ length: 30 }, (_, index) => project(String(index))));

    render(<ProjectsPreview {...widgetProps} />);

    expect(screen.getAllByTestId("project-row")).toHaveLength(5);
  });

  it("hides an empty section in view mode", () => {
    const { container } = render(<ProjectsPreview {...widgetProps} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("keeps an empty section available in edit mode", () => {
    render(<ProjectsPreview {...widgetProps} editing />);
    expect(screen.getByText(/This section hides/)).toBeInTheDocument();
  });

  it("says nothing at all when projects are turned off", () => {
    vi.mocked(useFlagValue).mockReturnValue(false);
    given(project("a"));

    const { container } = render(<ProjectsPreview {...widgetProps} />);

    expect(container).toBeEmptyDOMElement();
  });

  /** The runs section below already reports an unreachable backend. */
  it("stays out of the way when the backend cannot answer", () => {
    vi.mocked(useBackend).mockReturnValue({
      configured: true,
      available: false,
    } as unknown as ReturnType<typeof useBackend>);

    const { container } = render(<ProjectsPreview {...widgetProps} />);

    expect(container).toBeEmptyDOMElement();
  });
});
