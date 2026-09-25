import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useFlagValue } from "@/components/shared/Settings/useFlags";
import type { Project } from "@/services/projects/types";
import { useProjectsById } from "@/services/projects/useProjects";

import { ProjectDetailsSection } from "./ProjectDetailsSection";

vi.mock("@/components/shared/Settings/useFlags", () => ({
  useFlagValue: vi.fn(),
}));

vi.mock("@/services/projects/useProjects", () => ({
  useProjectsById: vi.fn(),
}));

vi.mock("@/routes/projectRoutes", () => ({
  getProjectHomePath: (projectId: string) => `/tangent/${projectId}`,
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => (
    <a href={to}>{children}</a>
  ),
}));

function project(overrides: Partial<Project> = {}) {
  return {
    id: "project-1",
    name: "Churn work",
    description: "Everything about churn",
    resourceCounts: { pipeline: 2, agent_session: 1 },
    ...overrides,
  } as Project;
}

const given = (projects: Project[] = [project()]) =>
  vi.mocked(useProjectsById).mockReturnValue(projects);

describe("ProjectDetailsSection", () => {
  beforeEach(() => {
    given();
    vi.mocked(useFlagValue).mockReturnValue(true);
  });
  afterEach(() => vi.resetAllMocks());

  it("stays out of the way when nothing is attributed", () => {
    given([]);

    const { container } = render(<ProjectDetailsSection projectIds={[]} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("says which project the work belongs to", () => {
    render(<ProjectDetailsSection projectIds={["project-1"]} />);

    expect(screen.getByText("Project")).toBeInTheDocument();
    expect(screen.getByText("Churn work")).toBeInTheDocument();
    expect(screen.getByText("Everything about churn")).toBeInTheDocument();
  });

  it("offers a way into it", () => {
    render(<ProjectDetailsSection projectIds={["project-1"]} />);

    expect(screen.getByRole("link", { name: /Open project/ })).toHaveAttribute(
      "href",
      "/tangent/project-1",
    );
  });

  /** Sessions belong to Tangent, so they are not counted without it. */
  it("counts only what the reader can actually see", () => {
    vi.mocked(useFlagValue).mockReturnValue(false);

    render(<ProjectDetailsSection projectIds={["project-1"]} />);

    expect(screen.getByText("2 pipelines")).toBeInTheDocument();
  });

  it("counts the sessions once Tangent is on", () => {
    render(<ProjectDetailsSection projectIds={["project-1"]} />);

    expect(
      screen.getByText("2 pipelines · 1 agent session"),
    ).toBeInTheDocument();
  });

  it("heads the section for a run that went to several projects", () => {
    given([project(), project({ id: "project-2", name: "Q3 models" })]);

    render(<ProjectDetailsSection projectIds={["project-1", "project-2"]} />);

    expect(screen.getByText("Projects")).toBeInTheDocument();
  });

  /**
   * Attribution outlives the project it names, and there is nothing to be done
   * about one that has gone — so it is not mentioned at all.
   */
  it("shows nothing whatever when the project has been deleted since", () => {
    given([]);

    const { container } = render(
      <ProjectDetailsSection projectIds={["project-1"]} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("still names the projects that are left", () => {
    given([project({ id: "project-2", name: "Q3 models" })]);

    render(<ProjectDetailsSection projectIds={["project-1", "project-2"]} />);

    expect(screen.getByText("Project")).toBeInTheDocument();
    expect(screen.getByText("Q3 models")).toBeInTheDocument();
  });
});
