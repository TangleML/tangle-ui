import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useProjectPin } from "@/components/Project/useProjectPin";
import { useBackend } from "@/providers/BackendProvider";
import { ProjectsApiError } from "@/services/projects/errors";
import { listProjects } from "@/services/projects/projectsService";
import type { ProjectSummary, Workspace } from "@/services/projects/types";
import { useWorkspaces } from "@/services/projects/useWorkspaces";
import { formatDate, formatRelativeTime } from "@/utils/date";
import { getUserDetails } from "@/utils/user";

import { ProjectsSection } from "./ProjectsSection";

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

const backendUrl = "https://backend.example";

function mockBackend(
  overrides: Partial<ReturnType<typeof useBackend>> = {},
): void {
  vi.mocked(useBackend).mockReturnValue({
    backendUrl,
    configured: true,
    available: true,
    ready: true,
    ...overrides,
  } as ReturnType<typeof useBackend>);
}

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

const retiredWorkspace: Workspace = {
  ...workspace,
  id: "retired",
  name: "Past experiments",
  isActive: false,
};

const archivedProjects = Array.from({ length: 11 }, (_, index) => ({
  ...otherProject,
  id: `archived-${index + 1}`,
  name: `Archived project ${index + 1}`,
  workspaceId: retiredWorkspace.id,
}));

function mockPagedDirectory() {
  const projects = [project, otherProject, ...archivedProjects];
  vi.mocked(listProjects).mockImplementation(async (params = {}) => {
    const matching = projects.filter(
      ({ createdBy, workspaceId }) =>
        (!params.createdBy || createdBy === params.createdBy) &&
        (!params.workspaceId || workspaceId === params.workspaceId),
    );
    const offset = params.pageToken === "second-page" ? 10 : 0;
    return {
      items: matching.slice(offset, offset + 10),
      totalCount: matching.length,
      nextPageToken: matching.length > offset + 10 ? "second-page" : null,
    };
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
    vi.mocked(useProjectPin).mockReturnValue({
      pinned: false,
      isPinning: false,
      togglePin: vi.fn(),
    });
    vi.mocked(listProjects).mockResolvedValue(directoryPage);

    // Radix Select uses these when the workspace menu opens in jsdom.
    const missingMethods = ["scrollIntoView", "hasPointerCapture"].filter(
      (method) => !(method in Element.prototype),
    );
    for (const method of missingMethods) {
      Reflect.set(Element.prototype, method, vi.fn());
    }
    return () => {
      for (const method of missingMethods) {
        Reflect.deleteProperty(Element.prototype, method);
      }
    };
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("shows every creator in a single table and pages through the directory", async () => {
    mockPagedDirectory();
    const user = userEvent.setup();
    renderSection();

    expect(screen.getByRole("heading", { name: "All projects" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "My projects" })).toBeNull();
    const table = within(screen.getByRole("table", { name: "All projects" }));
    expect(
      await table.findByRole("link", { name: "Forecasting" }),
    ).toBeVisible();
    expect(table.getByRole("link", { name: "Churn model" })).toHaveAttribute(
      "href",
      "/projects/project-1",
    );
    expect(table.getAllByRole("row")).toHaveLength(11);
    expect(screen.getByRole("button", { name: "First page" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(
      await table.findByRole("link", { name: "Archived project 11" }),
    ).toBeVisible();
    expect(table.queryByRole("link", { name: "Forecasting" })).toBeNull();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    expect(listProjects).toHaveBeenLastCalledWith(
      {
        pageSize: 10,
        pageToken: "second-page",
      },
      backendUrl,
    );
    await user.click(screen.getByRole("button", { name: "Previous" }));
    expect(
      await table.findByRole("link", { name: "Forecasting" }),
    ).toBeVisible();
    expect(
      table.queryByRole("link", { name: "Archived project 11" }),
    ).toBeNull();
  });

  it("combines creator and workspace filters and resets the cursor when filters change", async () => {
    mockPagedDirectory();
    vi.mocked(useWorkspaces).mockReturnValue({
      data: [workspace, retiredWorkspace],
    } as ReturnType<typeof useWorkspaces>);
    const user = userEvent.setup();
    renderSection();

    const filters = within(
      screen.getByRole("search", { name: "Project filters" }),
    );
    const creator = filters.getByRole("textbox", { name: "Search by user" });
    const workspaceFilter = filters.getByRole("combobox", {
      name: "Filter by workspace",
    });
    const table = within(screen.getByRole("table", { name: "All projects" }));
    await table.findByRole("link", { name: "Churn model" });

    await user.type(creator, otherProject.createdBy);
    await table.findByRole("link", { name: "Archived project 9" });
    expect(table.queryByRole("link", { name: "Churn model" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Next" }));
    await table.findByRole("link", { name: "Archived project 11" });
    expect(screen.getByText("Page 2")).toBeVisible();

    await user.click(workspaceFilter);
    await user.click(
      screen.getByRole("option", { name: retiredWorkspace.name }),
    );
    await table.findByRole("link", { name: "Archived project 1" });
    expect(table.queryByRole("link", { name: "Forecasting" })).toBeNull();
    expect(listProjects).toHaveBeenLastCalledWith(
      {
        createdBy: otherProject.createdBy,
        workspaceId: retiredWorkspace.id,
        pageSize: 10,
        pageToken: undefined,
      },
      backendUrl,
    );
    expect(screen.getByText("Page 1")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Next" }));
    await table.findByRole("link", { name: "Archived project 11" });
    expect(listProjects).toHaveBeenLastCalledWith(
      {
        createdBy: otherProject.createdBy,
        workspaceId: retiredWorkspace.id,
        pageSize: 10,
        pageToken: "second-page",
      },
      backendUrl,
    );

    await user.click(
      filters.getByRole("button", { name: "Clear all filters" }),
    );
    expect(
      await table.findByRole("link", { name: "Churn model" }),
    ).toBeVisible();
    expect(creator).toHaveValue("");
    expect(workspaceFilter).toHaveTextContent("All workspaces");
    expect(screen.getByText("Page 1")).toBeVisible();
  });

  it("uses the current user's ID for Me and returns everyone's projects when cleared", async () => {
    mockPagedDirectory();
    const user = userEvent.setup();
    renderSection();
    const table = within(screen.getByRole("table", { name: "All projects" }));
    await table.findByRole("link", { name: "Forecasting" });

    await user.click(screen.getByRole("button", { name: "Me" }));
    await screen.findByRole("button", { name: "Clear user filter" });
    await waitFor(() => {
      expect(listProjects).toHaveBeenLastCalledWith(
        expect.objectContaining({ createdBy: project.createdBy }),
        backendUrl,
      );
      expect(table.queryByRole("link", { name: "Forecasting" })).toBeNull();
    });
    expect(
      await table.findByRole("link", { name: "Churn model" }),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Clear user filter" }));
    expect(
      await table.findByRole("link", { name: "Forecasting" }),
    ).toBeVisible();
  });

  it("keeps cached directory results out of Me when the current user is unknown", async () => {
    vi.mocked(getUserDetails).mockResolvedValue({
      id: "Unknown",
      permissions: ["read"],
    });
    const user = userEvent.setup();
    renderSection();
    const table = within(screen.getByRole("table", { name: "All projects" }));
    await table.findByRole("link", { name: "Forecasting" });

    await user.click(screen.getByRole("button", { name: "Me" }));
    expect(
      await table.findByText("Unable to identify the current user."),
    ).toBeVisible();
    expect(table.queryByRole("link")).toBeNull();
    expect(listProjects).toHaveBeenCalledOnce();
    await user.click(screen.getByRole("button", { name: "Clear user filter" }));
    expect(
      await table.findByRole("link", { name: "Forecasting" }),
    ).toBeVisible();
  });

  it("shows only the linked title in the Name column and keeps the other project details and actions", async () => {
    vi.mocked(useProjectPin).mockReturnValue({
      pinned: true,
      isPinning: false,
      togglePin: vi.fn(),
    });
    const user = userEvent.setup();
    renderSection();

    const table = within(screen.getByRole("table", { name: "All projects" }));
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

  it("opens the New project dialog with the available workspaces even when the directory is empty", async () => {
    vi.mocked(getUserDetails).mockResolvedValue({
      id: "someone@example.com",
      permissions: ["read", "write", "admin"],
    });
    vi.mocked(useWorkspaces).mockReturnValue({
      data: [
        workspace,
        { ...workspace, id: "workspace-2", name: "Growth" },
        retiredWorkspace,
      ],
    } as ReturnType<typeof useWorkspaces>);
    vi.mocked(listProjects).mockResolvedValue({
      items: [],
      nextPageToken: null,
      totalCount: 0,
    });
    const user = userEvent.setup();
    renderSection();

    expect(await screen.findByText("No projects yet.")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "New project" }));
    const dialog = within(
      await screen.findByRole("dialog", { name: "New Project" }),
    );
    expect(dialog.getByRole("textbox", { name: "Name" })).toBeVisible();
    await user.click(dialog.getByRole("combobox", { name: "Workspace" }));
    expect(screen.getByRole("option", { name: workspace.name })).toBeVisible();
    expect(screen.getByRole("option", { name: "Growth" })).toBeVisible();
    expect(
      screen.queryByRole("option", { name: retiredWorkspace.name }),
    ).toBeNull();
  });

  it.each([
    { scope: "empty", workspaces: [] },
    { scope: "retired only", workspaces: [retiredWorkspace] },
  ])(
    "keeps the directory visible when workspaces are $scope",
    async ({ workspaces }) => {
      vi.mocked(useWorkspaces).mockReturnValue({
        data: workspaces,
      } as ReturnType<typeof useWorkspaces>);
      renderSection();
      expect(
        await screen.findByRole("link", { name: "Forecasting" }),
      ).toBeVisible();
      expect(
        screen.getByText(
          "Projects cannot be created yet. Contact your Tangle Admin for help.",
        ),
      ).toBeVisible();
      expect(screen.queryByRole("button", { name: "New project" })).toBeNull();
    },
  );

  it("surfaces a failure to load the directory", async () => {
    vi.mocked(listProjects).mockRejectedValue(
      new ProjectsApiError("Failed to list projects", 403),
    );
    renderSection();
    const table = within(screen.getByRole("table", { name: "All projects" }));
    expect(await table.findByText("Failed to list projects")).toBeVisible();
  });

  it("asks the user to configure a backend before querying", async () => {
    mockBackend({ configured: false, available: false });

    renderSection();

    expect(
      await screen.findByText("Backend not configured"),
    ).toBeInTheDocument();
    expect(listProjects).not.toHaveBeenCalled();
  });

  it("reports a configured backend that is unreachable", async () => {
    mockBackend({ available: false });

    renderSection();

    expect(
      await screen.findByText("Backend not available"),
    ).toBeInTheDocument();
    expect(listProjects).not.toHaveBeenCalled();
  });

  it("waits for the backend probe to settle before deciding", () => {
    mockBackend({ ready: false, available: false });

    renderSection();

    expect(screen.getByText("Loading...")).toBeInTheDocument();
    expect(screen.queryByText("Backend not available")).toBeNull();
  });
});
