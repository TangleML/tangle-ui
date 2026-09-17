import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useBackend } from "@/providers/BackendProvider";
import type { ProjectSummary, Workspace } from "@/services/projects/types";
import { useProjects } from "@/services/projects/useProjects";
import { useWorkspaces } from "@/services/projects/useWorkspaces";
import { getUserDetails } from "@/utils/user";

import { ProjectsSection } from "./ProjectsSection";

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
}));

vi.mock("@/providers/BackendProvider", () => ({
  useBackend: vi.fn(),
}));

vi.mock("@/services/projects/useProjects", () => ({
  useProjects: vi.fn(),
  useDeleteProject: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock("@/hooks/useToastNotification", () => ({
  default: () => vi.fn(),
}));

vi.mock("@/providers/AnalyticsProvider", () => ({
  useAnalytics: () => ({ track: vi.fn() }),
}));

vi.mock("@/services/projects/useWorkspaces", () => ({
  useWorkspaces: vi.fn(),
}));

vi.mock("@/utils/user", () => ({
  getUserDetails: vi.fn(),
}));

vi.mock("./CreateProjectDialog", () => ({
  CreateProjectDialog: ({
    workspaces,
    canChooseWorkspace,
  }: {
    workspaces: Workspace[];
    canChooseWorkspace: boolean;
  }) => (
    <button
      data-workspace-count={workspaces.length}
      data-can-choose-workspace={String(canChooseWorkspace)}
    >
      New Project
    </button>
  ),
}));

const workspace: Workspace = {
  id: "workspace-1",
  name: "ML Research",
  description: null,
  isActive: true,
  extraData: null,
  createdAt: new Date("2026-09-01T10:00:00Z"),
};

const project: ProjectSummary = {
  id: "project-1",
  workspaceId: "workspace-1",
  name: "Churn model",
  description: "Q3 churn work",
  createdBy: "someone@example.com",
  origin: "user",
  createdAt: new Date("2026-09-02T10:00:00Z"),
  updatedAt: new Date("2026-09-15T10:00:00Z"),
  resourceCounts: { pipeline: 3, document: 1 },
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

function mockProjects(
  overrides: Partial<ReturnType<typeof useProjects>> = {},
): void {
  vi.mocked(useProjects).mockReturnValue({
    data: { items: [project], nextPageToken: null, totalCount: 1 },
    isPending: false,
    error: null,
    ...overrides,
  } as ReturnType<typeof useProjects>);
}

function renderSection() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ProjectsSection />
    </QueryClientProvider>,
  );
}

describe("ProjectsSection", () => {
  beforeEach(() => {
    vi.mocked(getUserDetails).mockResolvedValue({
      id: "someone@example.com",
      permissions: ["read", "write"],
    });
    vi.mocked(useWorkspaces).mockReturnValue({
      data: [workspace],
    } as ReturnType<typeof useWorkspaces>);
    mockBackend();
    mockProjects();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("asks the backend only for the current user's projects", async () => {
    renderSection();

    await waitFor(() => {
      expect(useProjects).toHaveBeenCalledWith({
        createdBy: "someone@example.com",
        pageSize: 100,
      });
    });
  });

  it("lists every project when the user cannot be identified", async () => {
    vi.mocked(getUserDetails).mockResolvedValue({
      id: "Unknown",
      permissions: [],
    });

    renderSection();

    await waitFor(() => {
      expect(useProjects).toHaveBeenCalledWith({
        createdBy: undefined,
        pageSize: 100,
      });
    });
  });

  it("renders a project with its resource counts", async () => {
    renderSection();

    expect(await screen.findByText("Churn model")).toBeInTheDocument();
    expect(screen.getByText("Q3 churn work")).toBeInTheDocument();
    expect(screen.getByText("3 pipelines · 1 document")).toBeInTheDocument();
  });

  it("keeps the workspace out of the project list entirely", async () => {
    renderSection();

    await screen.findByText("Churn model");

    expect(screen.queryByText("ML Research")).toBeNull();
    expect(screen.queryByText("workspace-1")).toBeNull();
  });

  it("lets an admin choose between workspaces", async () => {
    vi.mocked(getUserDetails).mockResolvedValue({
      id: "someone@example.com",
      permissions: ["read", "write", "admin"],
    });

    renderSection();

    expect(
      await screen.findByRole("button", { name: "New Project" }),
    ).toHaveAttribute("data-can-choose-workspace", "true");
  });

  it("does not let a plain writer choose between workspaces", async () => {
    renderSection();

    expect(
      await screen.findByRole("button", { name: "New Project" }),
    ).toHaveAttribute("data-can-choose-workspace", "false");
  });

  it("points at an admin when the deployment has no workspace to create in", async () => {
    vi.mocked(useWorkspaces).mockReturnValue({
      data: [],
    } as unknown as ReturnType<typeof useWorkspaces>);

    renderSection();

    expect(
      await screen.findByText("No workspace available"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Projects cannot be created yet. Contact your Tangle Admin for help.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "New Project" })).toBeNull();
  });

  it("invites the user to create a project when they have none", async () => {
    mockProjects({
      data: { items: [], nextPageToken: null, totalCount: 0 },
    } as Partial<ReturnType<typeof useProjects>>);

    renderSection();

    expect(await screen.findByText("No projects yet")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "New Project" }),
    ).toBeInTheDocument();
  });

  it("offers project creation alongside an existing list", async () => {
    renderSection();

    expect(
      await screen.findByRole("button", { name: "New Project" }),
    ).toHaveAttribute("data-workspace-count", "1");
  });

  it("says how much of a truncated list is shown", async () => {
    mockProjects({
      data: { items: [project], nextPageToken: "next", totalCount: 140 },
    } as Partial<ReturnType<typeof useProjects>>);

    renderSection();

    expect(
      await screen.findByText("Showing the first 1 of 140 projects."),
    ).toBeInTheDocument();
  });

  it("surfaces a failure to load the list", async () => {
    mockProjects({
      data: undefined,
      error: new Error("Failed to list projects"),
    } as Partial<ReturnType<typeof useProjects>>);

    renderSection();

    expect(
      await screen.findByText("Failed to list projects"),
    ).toBeInTheDocument();
  });

  it("asks the user to configure a backend before querying", async () => {
    mockBackend({ configured: false, available: false });

    renderSection();

    expect(
      await screen.findByText("Backend not configured"),
    ).toBeInTheDocument();
    expect(useProjects).not.toHaveBeenCalled();
  });

  it("reports a configured backend that is unreachable", async () => {
    mockBackend({ available: false });

    renderSection();

    expect(
      await screen.findByText("Backend not available"),
    ).toBeInTheDocument();
    expect(useProjects).not.toHaveBeenCalled();
  });

  it("waits for the backend probe to settle before deciding", () => {
    mockBackend({ ready: false, available: false });

    renderSection();

    expect(screen.getByText("Loading...")).toBeInTheDocument();
    expect(screen.queryByText("Backend not available")).toBeNull();
  });
});
