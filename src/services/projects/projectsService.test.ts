import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  DeleteProjectResponse,
  ProjectResponse,
  ProjectSummaryResponse,
  WorkspaceResponse,
} from "@/api/types.gen";

vi.mock("@/api/sdk.gen");

import * as apiSdk from "@/api/sdk.gen";

import { ProjectsApiError, WorkspacesApiError } from "./errors";
import {
  createProject,
  deleteProject,
  getProject,
  listProjects,
  updateProject,
} from "./projectsService";
import { getWorkspace, listWorkspaces } from "./workspacesService";

const createMockApiResponse = <T>(data: T, status = 200) => ({
  data,
  error: undefined,
  request: new Request("http://test.local"),
  response: { status, ok: status >= 200 && status < 300 } as Response,
});

const createMockApiErrorResponse = (status: number) => ({
  data: undefined,
  error: {},
  request: new Request("http://test.local"),
  response: { status, ok: false } as Response,
});

const workspaceDto: WorkspaceResponse = {
  id: "w1",
  name: "Research",
  description: null,
  is_active: true,
  extra_data: { seeded: true },
  created_at: "2024-01-02T03:04:05Z",
};

const projectSummaryDto: ProjectSummaryResponse = {
  id: "p1",
  workspace_id: "w1",
  name: "My Project",
  description: "desc",
  created_by: "user@example.com",
  origin: "user",
  created_at: "2024-01-02T03:04:05Z",
  updated_at: "2024-02-03T04:05:06Z",
  resource_counts: { pipeline: 2, agent_session: 1 },
};

const projectDto: ProjectResponse = {
  ...projectSummaryDto,
  notes: "some notes",
  extra_data: { archived: false },
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("workspacesService", () => {
  it("lists and maps workspaces to domain types", async () => {
    vi.mocked(apiSdk.listWorkspacesApiWorkspacesGet).mockResolvedValue(
      createMockApiResponse({ workspaces: [workspaceDto], total_count: 1 }),
    );

    const result = await listWorkspaces();

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: "w1",
      name: "Research",
      description: null,
      isActive: true,
      extraData: { seeded: true },
      createdAt: new Date("2024-01-02T03:04:05Z"),
    });
  });

  it("fetches and maps a single workspace", async () => {
    vi.mocked(apiSdk.getWorkspaceApiWorkspacesWorkspaceIdGet).mockResolvedValue(
      createMockApiResponse(workspaceDto),
    );

    const result = await getWorkspace("w1");

    expect(apiSdk.getWorkspaceApiWorkspacesWorkspaceIdGet).toHaveBeenCalledWith(
      {
        path: { workspace_id: "w1" },
      },
    );
    expect(result.id).toBe("w1");
  });

  it("throws WorkspacesApiError with status on non-2xx", async () => {
    vi.mocked(apiSdk.listWorkspacesApiWorkspacesGet).mockResolvedValue(
      createMockApiErrorResponse(503),
    );

    await expect(listWorkspaces()).rejects.toBeInstanceOf(WorkspacesApiError);
    await expect(listWorkspaces()).rejects.toMatchObject({ status: 503 });
  });
});

describe("projectsService", () => {
  it("lists projects and maps pagination fields", async () => {
    vi.mocked(apiSdk.listProjectsApiProjectsGet).mockResolvedValue(
      createMockApiResponse({
        projects: [projectSummaryDto],
        total_count: 5,
        next_page_token: "tok-2",
      }),
    );

    const page = await listProjects({ workspaceId: "w1", pageSize: 20 });

    expect(apiSdk.listProjectsApiProjectsGet).toHaveBeenCalledWith({
      query: {
        workspace_id: "w1",
        created_by: undefined,
        page_token: undefined,
        page_size: 20,
      },
    });
    expect(page.totalCount).toBe(5);
    expect(page.nextPageToken).toBe("tok-2");
    expect(page.items[0]).toEqual({
      id: "p1",
      workspaceId: "w1",
      name: "My Project",
      description: "desc",
      createdBy: "user@example.com",
      origin: "user",
      createdAt: new Date("2024-01-02T03:04:05Z"),
      updatedAt: new Date("2024-02-03T04:05:06Z"),
      resourceCounts: { pipeline: 2, agent_session: 1 },
    });
  });

  it("defaults nextPageToken to null when absent", async () => {
    vi.mocked(apiSdk.listProjectsApiProjectsGet).mockResolvedValue(
      createMockApiResponse({
        projects: [],
        total_count: 0,
      }),
    );

    const page = await listProjects();

    expect(page.nextPageToken).toBeNull();
    expect(page.items).toEqual([]);
  });

  it("fetches a single project including notes", async () => {
    vi.mocked(apiSdk.getProjectApiProjectsProjectIdGet).mockResolvedValue(
      createMockApiResponse(projectDto),
    );

    const project = await getProject("p1");

    expect(project.notes).toBe("some notes");
    expect(project.workspaceId).toBe("w1");
    expect(project.extraData).toEqual({ archived: false });
  });

  it("creates a project mapping input to the request body", async () => {
    vi.mocked(apiSdk.createProjectApiProjectsPost).mockResolvedValue(
      createMockApiResponse(projectDto, 201),
    );

    const project = await createProject({
      workspaceId: "w1",
      name: "My Project",
      description: "desc",
      notes: "some notes",
      origin: "user",
      extraData: { archived: false },
    });

    expect(apiSdk.createProjectApiProjectsPost).toHaveBeenCalledWith({
      body: {
        workspace_id: "w1",
        name: "My Project",
        description: "desc",
        notes: "some notes",
        origin: "user",
        extra_data: { archived: false },
      },
    });
    expect(project.id).toBe("p1");
    expect(project.extraData).toEqual({ archived: false });
  });

  it("updates a project", async () => {
    vi.mocked(apiSdk.updateProjectApiProjectsProjectIdPatch).mockResolvedValue(
      createMockApiResponse(projectDto),
    );

    const project = await updateProject("p1", { name: "Renamed" });

    expect(apiSdk.updateProjectApiProjectsProjectIdPatch).toHaveBeenCalledWith({
      path: { project_id: "p1" },
      body: {
        name: "Renamed",
        description: undefined,
        notes: undefined,
        extra_data: undefined,
      },
    });
    expect(project.id).toBe("p1");
  });

  it("deletes a project and maps the removal summary", async () => {
    const deleteDto: DeleteProjectResponse = {
      id: "p1",
      deleted_resource_counts: { document: 3, agent_session: 2 },
      deleted_resource_total: 5,
    };
    vi.mocked(apiSdk.deleteProjectApiProjectsProjectIdDelete).mockResolvedValue(
      createMockApiResponse(deleteDto),
    );

    const result = await deleteProject("p1");

    expect(result).toEqual({
      id: "p1",
      deletedResourceCounts: { document: 3, agent_session: 2 },
      deletedResourceTotal: 5,
    });
  });

  it("throws ProjectsApiError with status on non-2xx", async () => {
    vi.mocked(apiSdk.getProjectApiProjectsProjectIdGet).mockResolvedValue(
      createMockApiErrorResponse(404),
    );

    await expect(getProject("missing")).rejects.toBeInstanceOf(
      ProjectsApiError,
    );
    await expect(getProject("missing")).rejects.toMatchObject({ status: 404 });
  });
});
