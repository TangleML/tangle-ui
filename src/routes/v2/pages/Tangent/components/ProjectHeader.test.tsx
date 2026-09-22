import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useProject } from "@/services/projects/useProjects";

import { ProjectHeader } from "./ProjectHeader";

const updateProject = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    params,
    ...rest
  }: {
    children: ReactNode;
    to: string;
    params?: { projectId: string };
  }) => (
    <a
      href={params ? to.replace("$projectId", params.projectId) : to}
      {...rest}
    >
      {children}
    </a>
  ),
}));

vi.mock("@/routes/v2/pages/Tangent/context/TangentProjectContext", () => ({
  useTangentProject: () => ({ projectId: "project-1" }),
}));

vi.mock("@/providers/AnalyticsProvider", () => ({
  useAnalytics: () => ({ track: vi.fn() }),
}));

vi.mock("@/hooks/useToastNotification", () => ({
  default: () => vi.fn(),
}));

vi.mock("@/services/projects/useProjects", () => ({
  useProject: vi.fn(),
  useUpdateProject: () => ({ mutate: updateProject, isPending: false }),
}));

const project = {
  id: "project-1",
  name: "Churn model",
  description: "Q3 churn work",
  notes: null,
  workspaceId: "workspace-1",
  createdBy: "alice@example.com",
  origin: "user",
  extraData: null,
  createdAt: new Date("2026-09-02T10:00:00Z"),
  updatedAt: new Date("2026-09-15T10:00:00Z"),
};

describe("Tangent ProjectHeader", () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
    Element.prototype.hasPointerCapture = vi.fn();
    vi.mocked(useProject).mockReturnValue({
      data: project,
    } as unknown as ReturnType<typeof useProject>);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("offers the project's own page from its name", () => {
    render(<ProjectHeader />);

    expect(screen.getByRole("link", { name: /Churn model/ })).toHaveAttribute(
      "href",
      "/projects/project-1",
    );
    expect(screen.getByText("Churn model")).toBeInTheDocument();
  });

  /** The way out was the logo, which leaves Tangent rather than going up one. */
  it("offers a way back to the projects list", () => {
    render(<ProjectHeader />);

    expect(
      screen.getByRole("link", { name: "Back to projects" }),
    ).toHaveAttribute("href", "/projects");
  });

  /** Pinning is the only thing that keeps a shared project reachable. */
  it("offers to pin the project from inside it", () => {
    render(<ProjectHeader />);

    expect(
      screen.getByRole("button", { name: "Pin Churn model" }),
    ).toBeInTheDocument();
  });

  /** The name used to rename on click, which cost the only way back out. */
  it("does not rename when the name is clicked", async () => {
    const user = userEvent.setup();
    render(<ProjectHeader />);

    await user.click(screen.getByText("Churn model"));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(updateProject).not.toHaveBeenCalled();
  });

  it("renames from the pencil beside it", async () => {
    const user = userEvent.setup();
    render(<ProjectHeader />);

    await user.click(
      screen.getByRole("button", { name: "Rename Churn model" }),
    );

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("says nothing about the workspace the project lives in", () => {
    render(<ProjectHeader />);

    expect(screen.queryByText(/workspace/i)).toBeNull();
  });
});
