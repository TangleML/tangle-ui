import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useProjectPin } from "@/components/Project/useProjectPin";
import { useBackend } from "@/providers/BackendProvider";
import { listProjects } from "@/services/projects/projectsService";
import type { ProjectSummary, Workspace } from "@/services/projects/types";
import { usePinnedProjects } from "@/services/projects/usePinnedProjects";
import { useWorkspaces } from "@/services/projects/useWorkspaces";
import { formatDate, formatRelativeTime } from "@/utils/date";
import { getUserDetails } from "@/utils/user";

import { ProjectsSection } from "./ProjectsSection";
import { useMyProjects } from "./useMyProjects";

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  useNavigate: () => vi.fn(),
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

vi.mock("@/providers/BackendProvider", () => ({
  useBackend: vi.fn(),
}));

vi.mock("@/services/projects/projectsService", () => ({
  listProjects: vi.fn(),
}));

vi.mock("@/services/projects/useProjects", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/projects/useProjects")>()),
  useDeleteProject: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock("./useMyProjects", () => ({ useMyProjects: vi.fn() }));

vi.mock("@/services/projects/usePinnedProjects", () => ({
  usePinnedProjects: vi.fn(),
}));

vi.mock("@/components/Project/useProjectPin", () => ({
  useProjectPin: vi.fn(),
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
    trigger,
  }: {
    workspaces: Workspace[];
    trigger: ReactNode;
  }) => (
    <div
      data-testid="create-project"
      data-workspace-ids={workspaces.map(({ id }) => id).join(",")}
    >
      {trigger}
    </div>
  ),
}));

const workspace: Workspace = {
  id: "workspace-1",
  name: "ML Research",
  description: null,
  isActive: true,
  metadata: null,
  createdAt: new Date("2026-09-01T10:00:00Z"),
};

const project: ProjectSummary = {
  id: "project-1",
  workspaceId: "workspace-1",
  name: "Churn model",
  description: "Q3 churn work",
  createdBy: "someone@example.com",
  origin: "user",
  metadata: null,
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
const otherProject = {
  ...project,
  id: "project-2",
  name: "Forecasting",
  createdBy: "teammate@example.com",
};
const directoryPage = {
  items: [otherProject],
  totalCount: 1,
  nextPageToken: null,
};

function mockPinned(...projects: ProjectSummary[]): void {
  vi.mocked(usePinnedProjects).mockReturnValue({ projects, isPending: false });
  vi.mocked(useProjectPin).mockImplementation(({ id }) => ({
    pinned: projects.some((project) => project.id === id),
    isPinning: false,
    togglePin: vi.fn(),
  }));
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
    vi.mocked(listProjects).mockResolvedValue(directoryPage);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // Which projects count as the user's own is `useMyProjects`'s job and is
  // covered by its own tests.

  it("pages through every creator's projects independently of the cards", async () => {
    const firstPage = [
      otherProject,
      project,
      ...Array.from({ length: 8 }, (_, i) => ({
        ...otherProject,
        id: `additional-${i}`,
        name: `Additional project ${i}`,
      })),
    ];
    const lastProject = { ...otherProject, id: "last", name: "Final project" };
    vi.mocked(listProjects).mockImplementation(async (params) =>
      params?.pageToken === "second-page"
        ? { items: [lastProject], totalCount: 11, nextPageToken: null }
        : { items: firstPage, totalCount: 11, nextPageToken: "second-page" },
    );
    const user = userEvent.setup();
    renderSection();

    const mine = within(screen.getByRole("region", { name: "My projects" }));
    const all = within(screen.getByRole("region", { name: "All projects" }));
    const table = within(
      await all.findByRole("table", { name: "All projects" }),
    );
    expect(
      await table.findByRole("link", { name: "Forecasting" }),
    ).toBeVisible();
    expect(mine.queryByText("Forecasting")).toBeNull();
    expect(table.getAllByRole("row")).toHaveLength(11);
    expect(table.getByRole("link", { name: "Churn model" })).toHaveAttribute(
      "href",
      mine.getByRole("link", { name: /Churn model/ }).getAttribute("href"),
    );
    expect(all.getByRole("button", { name: "First page" })).toBeDisabled();
    expect(all.getByRole("button", { name: "Previous" })).toBeDisabled();
    await user.click(all.getByRole("button", { name: "Next" }));
    expect(
      await table.findByRole("link", { name: "Final project" }),
    ).toBeVisible();
    expect(table.queryByRole("link", { name: "Forecasting" })).toBeNull();
    expect(all.getByRole("button", { name: "Next" })).toBeDisabled();
    expect(mine.getByRole("link", { name: /Churn model/ })).toBeVisible();
    await user.click(all.getByRole("button", { name: "Previous" }));
    expect(
      await table.findByRole("link", { name: "Forecasting" }),
    ).toBeVisible();
    expect(table.queryByRole("link", { name: "Final project" })).toBeNull();
    const requests = vi
      .mocked(listProjects)
      .mock.calls.map(([params]) => params);
    expect(requests).toContainEqual(
      expect.objectContaining({ pageSize: 10, pageToken: "second-page" }),
    );
    expect(requests.every((params) => params?.createdBy === undefined)).toBe(
      true,
    );
    expect(loadMore).not.toHaveBeenCalled();
  });

  it("shows only the linked title in the Name column and keeps the other project details and actions", async () => {
    mockPinned(otherProject);
    const user = userEvent.setup();
    renderSection();

    const all = within(screen.getByRole("region", { name: "All projects" }));
    const table = within(
      await all.findByRole("table", { name: "All projects" }),
    );
    expect(
      table.getAllByRole("columnheader").map((header) => header.textContent),
    ).toEqual([
      "Name",
      "Workspace",
      "Resources",
      "Created at",
      "Updated at",
      "Actions",
    ]);
    const row = within(await table.findByRole("row", { name: /Forecasting/ }));
    const [nameCell, workspaceCell, resources, created, updated, actions] =
      row.getAllByRole("cell");
    expect(
      within(nameCell).getByRole("link", { name: "Forecasting" }),
    ).toBeVisible();
    expect(nameCell).toHaveTextContent(/^Forecasting$/);
    expect(nameCell.querySelector("svg")).toBeNull();
    expect(workspaceCell).toHaveTextContent("ML Research");
    expect(resources).toHaveTextContent("3 pipelines · 1 document");
    expect(created).toHaveTextContent(formatDate(otherProject.createdAt));
    expect(updated).toHaveTextContent(
      formatRelativeTime(otherProject.updatedAt),
    );
    const mine = within(screen.getByRole("region", { name: "My projects" }));
    const card = within(mine.getByRole("link", { name: /Forecasting/ }));
    expect(card.getByLabelText("Pinned")).toBeVisible();
    expect(card.getByText("Q3 churn work")).toBeVisible();
    const handle = table.getByRole("separator", { name: "Resize Name column" });
    const initialWidth = Number(handle.getAttribute("aria-valuenow"));
    handle.focus();
    await user.keyboard("{ArrowRight}");
    expect(Number(handle.getAttribute("aria-valuenow"))).toBeGreaterThan(
      initialWidth,
    );
    await user.click(
      within(actions).getByRole("button", {
        name: "Project actions: Forecasting",
      }),
    );
    expect(
      await screen.findByRole("menuitem", { name: "Unpin project" }),
    ).toBeVisible();
    expect(
      screen.getByRole("menuitem", { name: "Share project" }),
    ).toBeVisible();
    expect(
      screen.getByRole("menuitem", { name: "Delete project" }),
    ).toBeVisible();
  });

  it("renders a project with its resource counts", async () => {
    renderSection();

    const mine = within(screen.getByRole("region", { name: "My projects" }));
    expect(await mine.findByText("Churn model")).toBeInTheDocument();
    expect(mine.getByText("Q3 churn work")).toBeInTheDocument();
    expect(mine.getByText("3 pipelines · 1 document")).toBeInTheDocument();
  });

  it("labels each project with its workspace", async () => {
    renderSection();

    const mine = within(screen.getByRole("region", { name: "My projects" }));
    expect(await mine.findByText("ML Research")).toBeInTheDocument();
  });

  it("offers an admin the same workspaces as anyone else", async () => {
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
      "data-workspace-ids",
      "workspace-1,workspace-2",
    );
  });

  it("treats a backend holding only retired workspaces as having none", async () => {
    vi.mocked(useWorkspaces).mockReturnValue({
      data: [{ ...workspace, isActive: false }],
    } as ReturnType<typeof useWorkspaces>);

    renderSection();

    expect(
      await screen.findByText(
        "Projects cannot be created yet. Contact your Tangle Admin for help.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "New project" })).toBeNull();
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
    const mine = within(screen.getByRole("region", { name: "My projects" }));
    expect(mine.queryByText(/workspace/i)).toBeNull();
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

    const mine = within(screen.getByRole("region", { name: "My projects" }));
    const tiles = mine.getAllByRole("button", {
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
