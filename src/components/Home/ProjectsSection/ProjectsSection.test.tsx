import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useBackend } from "@/providers/BackendProvider";
import type { ProjectSummary, Workspace } from "@/services/projects/types";
import { useWorkspaces } from "@/services/projects/useWorkspaces";
import { getUserDetails } from "@/utils/user";

import { ProjectsSection } from "./ProjectsSection";
import { useMyProjects } from "./useMyProjects";
import { usePinnedProjects } from "./usePinnedProjects";

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
}));

vi.mock("@/providers/BackendProvider", () => ({
  useBackend: vi.fn(),
}));

vi.mock("@/services/projects/useProjects", () => ({
  useDeleteProject: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock("./useMyProjects", () => ({ useMyProjects: vi.fn() }));

vi.mock("./usePinnedProjects", () => ({ usePinnedProjects: vi.fn() }));

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
    workspaceId,
    trigger,
  }: {
    workspaceId: string;
    trigger: ReactNode;
  }) => (
    <div data-testid="create-project" data-workspace-id={workspaceId}>
      {trigger}
    </div>
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

const loadMore = vi.fn();

function mockPinned(...projects: ProjectSummary[]): void {
  vi.mocked(usePinnedProjects).mockReturnValue({ projects, isPending: false });
}

function mockProjects(
  overrides: Partial<ReturnType<typeof useMyProjects>> = {},
): void {
  vi.mocked(useMyProjects).mockReturnValue({
    projects: [project],
    createdBy: "someone@example.com",
    totalCount: 1,
    isPending: false,
    error: null,
    hasMore: false,
    isLoadingMore: false,
    loadMore,
    ...overrides,
  });
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
    mockPinned();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // Which projects count as the user's own is `useMyProjects`'s job and is
  // covered by its own tests.

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

  it("creates into the first workspace the backend offers", async () => {
    vi.mocked(useWorkspaces).mockReturnValue({
      data: [workspace, { ...workspace, id: "workspace-2", name: "Growth" }],
    } as ReturnType<typeof useWorkspaces>);

    renderSection();

    await screen.findByRole("button", { name: "New project" });

    expect(screen.getByTestId("create-project")).toHaveAttribute(
      "data-workspace-id",
      "workspace-1",
    );
  });

  it("picks the same workspace for an admin as for anyone else", async () => {
    vi.mocked(getUserDetails).mockResolvedValue({
      id: "someone@example.com",
      permissions: ["read", "write", "admin"],
    });
    vi.mocked(useWorkspaces).mockReturnValue({
      data: [workspace, { ...workspace, id: "workspace-2", name: "Growth" }],
    } as ReturnType<typeof useWorkspaces>);

    renderSection();

    await screen.findByRole("button", { name: "New project" });

    expect(screen.getByTestId("create-project")).toHaveAttribute(
      "data-workspace-id",
      "workspace-1",
    );
  });

  it("points at an admin when there is nowhere to create a project", async () => {
    vi.mocked(useWorkspaces).mockReturnValue({
      data: [],
    } as unknown as ReturnType<typeof useWorkspaces>);

    renderSection();

    expect(
      await screen.findByText(
        "Projects cannot be created yet. Contact your Tangle Admin for help.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "New project" })).toBeNull();
    expect(screen.queryByText(/workspace/i)).toBeNull();
  });

  it("offers a new project card when the user has none", async () => {
    mockProjects({ projects: [], totalCount: 0 });

    renderSection();

    expect(
      await screen.findByRole("button", { name: "New project" }),
    ).toBeInTheDocument();
  });

  it("puts the new project card ahead of the existing projects", async () => {
    renderSection();

    await screen.findByText("Churn model");

    const tiles = screen.getAllByRole("button", { name: /New project|Churn/ });
    expect(tiles[0]).toHaveAccessibleName("New project");
  });

  it("says how much of a truncated list is shown", async () => {
    mockProjects({ hasMore: true, totalCount: 140 });

    renderSection();

    expect(await screen.findByText("Showing 1 of 140.")).toBeInTheDocument();
  });

  /** A long list was capped with no way past it, not paged. */
  it("fetches the next page rather than stopping at the first", async () => {
    mockProjects({ hasMore: true, totalCount: 140 });
    const user = userEvent.setup();

    renderSection();
    await user.click(
      await screen.findByRole("button", { name: "Load more projects" }),
    );

    expect(loadMore).toHaveBeenCalled();
  });

  it("offers nothing more to load once the list is complete", async () => {
    renderSection();

    await screen.findByText("Churn model");

    expect(
      screen.queryByRole("button", { name: "Load more projects" }),
    ).toBeNull();
  });

  it("surfaces a failure to load the list", async () => {
    mockProjects({
      projects: [],
      error: new Error("Failed to list projects"),
    });

    renderSection();

    expect(
      await screen.findByText("Failed to list projects"),
    ).toBeInTheDocument();
  });

  /** Pinning moves a project to the front; it does not clone it. */
  it("shows a pinned project of the user's own exactly once", async () => {
    mockPinned(project);

    renderSection();

    expect(await screen.findAllByText("Churn model")).toHaveLength(1);
  });

  it("puts a pinned project ahead of the rest, behind the new project card", async () => {
    const fraud = { ...project, id: "project-2", name: "Fraud model" };
    mockProjects({ projects: [fraud, project], totalCount: 2 });
    mockPinned(project);

    renderSection();

    const tiles = screen.getAllByRole("button", {
      name: /New project|Project actions/,
    });
    expect(tiles.map((tile) => tile.getAttribute("aria-label"))).toEqual([
      null,
      "Project actions: Churn model",
      "Project actions: Fraud model",
    ]);
  });

  /** A project someone else shared is pinned but was never in the user's own list. */
  it("shows a pinned project the backend never listed", async () => {
    mockPinned({ ...project, id: "project-9", name: "Shared work" });

    renderSection();

    expect(await screen.findByText("Shared work")).toBeInTheDocument();
    expect(screen.getByText("Churn model")).toBeInTheDocument();
  });

  it("counts a pinned project once, whoever owns it", async () => {
    mockProjects({
      projects: [project, { ...project, id: "project-2", name: "Fraud model" }],
      totalCount: 9,
      hasMore: true,
    });
    mockPinned(project, {
      ...project,
      id: "project-9",
      name: "Shared work",
      createdBy: "someone-else@example.com",
    });

    renderSection();

    expect(await screen.findByText("Showing 3 of 10.")).toBeInTheDocument();
  });

  /** Its page may not have been fetched, but it is still one of the user's own. */
  it("does not double-count a pinned project from a later page", async () => {
    mockProjects({ projects: [project], totalCount: 40, hasMore: true });
    mockPinned({ ...project, id: "project-40", name: "Deep in the list" });

    renderSection();

    expect(await screen.findByText("Showing 2 of 40.")).toBeInTheDocument();
  });

  it("asks the user to configure a backend before querying", async () => {
    mockBackend({ configured: false, available: false });

    renderSection();

    expect(
      await screen.findByText("Backend not configured"),
    ).toBeInTheDocument();
    expect(useMyProjects).not.toHaveBeenCalled();
  });

  it("reports a configured backend that is unreachable", async () => {
    mockBackend({ available: false });

    renderSection();

    expect(
      await screen.findByText("Backend not available"),
    ).toBeInTheDocument();
    expect(useMyProjects).not.toHaveBeenCalled();
  });

  it("waits for the backend probe to settle before deciding", () => {
    mockBackend({ ready: false, available: false });

    renderSection();

    expect(screen.getByText("Loading...")).toBeInTheDocument();
    expect(screen.queryByText("Backend not available")).toBeNull();
  });
});
