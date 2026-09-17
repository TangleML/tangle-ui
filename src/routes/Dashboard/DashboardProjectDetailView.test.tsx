import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useBackend } from "@/providers/BackendProvider";
import type { Project, Workspace } from "@/services/projects/types";
import { useProject } from "@/services/projects/useProjects";
import { useWorkspace } from "@/services/projects/useWorkspaces";

import { DashboardProjectDetailView } from "./DashboardProjectDetailView";

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  Link: ({ to, children }: { to: string; children: ReactNode }) => (
    <a href={to}>{children}</a>
  ),
  useParams: () => ({ projectId: "project-1" }),
}));

vi.mock("@/providers/BackendProvider", () => ({
  useBackend: vi.fn(),
}));

vi.mock("@/services/projects/useProjects", () => ({
  useProject: vi.fn(),
}));

vi.mock("@/services/projects/useWorkspaces", () => ({
  useWorkspace: vi.fn(),
}));

const workspace: Workspace = {
  id: "workspace-1",
  name: "ML Research",
  description: null,
  isActive: true,
  extraData: null,
  createdAt: new Date("2026-09-01T10:00:00Z"),
};

const project: Project = {
  id: "project-1",
  workspaceId: "workspace-1",
  name: "Churn model",
  description: "Q3 churn work",
  createdBy: "someone@example.com",
  origin: "user",
  createdAt: new Date("2026-09-02T10:00:00Z"),
  updatedAt: new Date("2026-09-15T10:00:00Z"),
  resourceCounts: { pipeline: 3, document: 1 },
  notes: null,
};

function mockBackend(
  overrides: Partial<ReturnType<typeof useBackend>> = {},
): void {
  vi.mocked(useBackend).mockReturnValue({
    configured: true,
    available: true,
    ready: true,
    ...overrides,
  } as ReturnType<typeof useBackend>);
}

function mockProject(
  overrides: Partial<ReturnType<typeof useProject>> = {},
): void {
  vi.mocked(useProject).mockReturnValue({
    data: project,
    isPending: false,
    error: null,
    ...overrides,
  } as ReturnType<typeof useProject>);
}

describe("DashboardProjectDetailView", () => {
  beforeEach(() => {
    mockBackend();
    mockProject();
    vi.mocked(useWorkspace).mockReturnValue({
      data: workspace,
      isPending: false,
    } as ReturnType<typeof useWorkspace>);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("shows the project it was asked for", () => {
    render(<DashboardProjectDetailView />);

    expect(useProject).toHaveBeenCalledWith("project-1");
    expect(
      screen.getByRole("heading", { name: "Churn model" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Q3 churn work")).toBeInTheDocument();
    expect(screen.getByText("ML Research")).toBeInTheDocument();
    expect(screen.getByText("3 pipelines · 1 document")).toBeInTheDocument();
  });

  it("always offers a way back to the list", () => {
    mockProject({ data: undefined, error: new Error("nope") } as Partial<
      ReturnType<typeof useProject>
    >);

    render(<DashboardProjectDetailView />);

    expect(
      screen.getByRole("link", { name: "Back to projects" }),
    ).toHaveAttribute("href", "/projects");
  });

  it("says nothing about the workspace until it is known", () => {
    vi.mocked(useWorkspace).mockReturnValue({
      data: undefined,
      isPending: true,
    } as ReturnType<typeof useWorkspace>);

    render(<DashboardProjectDetailView />);

    expect(screen.queryByText("workspace-1")).toBeNull();
    expect(screen.queryByText("Unknown workspace")).toBeNull();
  });

  it("does not show a raw workspace id when the workspace cannot be read", () => {
    vi.mocked(useWorkspace).mockReturnValue({
      data: undefined,
      isPending: false,
    } as ReturnType<typeof useWorkspace>);

    render(<DashboardProjectDetailView />);

    expect(screen.getByText("Unknown workspace")).toBeInTheDocument();
    expect(screen.queryByText("workspace-1")).toBeNull();
  });

  it("surfaces a failure to load the project", () => {
    mockProject({
      data: undefined,
      error: new Error("Failed to fetch project project-1"),
    } as Partial<ReturnType<typeof useProject>>);

    render(<DashboardProjectDetailView />);

    expect(
      screen.getByText("Failed to fetch project project-1"),
    ).toBeInTheDocument();
  });

  it("asks the user to configure a backend", () => {
    mockBackend({ configured: false, available: false });

    render(<DashboardProjectDetailView />);

    expect(screen.getByText("Backend not configured")).toBeInTheDocument();
  });
});
