import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./projectsService");
vi.mock("./workspacesService");

let backend = { configured: true, available: true };
vi.mock("@/providers/BackendProvider", () => ({
  useBackend: () => backend,
}));

import { ProjectsApiError } from "./errors";
import * as projectsService from "./projectsService";
import type { Project, ProjectPage, Workspace } from "./types";
import {
  useCreateProject,
  useDeleteProject,
  useProject,
  useProjects,
  useUpdateProject,
} from "./useProjects";
import { useWorkspace, useWorkspaces } from "./useWorkspaces";
import * as workspacesService from "./workspacesService";

const workspace: Workspace = {
  id: "w1",
  name: "Research",
  description: null,
  isActive: true,
  extraData: null,
  createdAt: new Date("2024-01-02T03:04:05Z"),
};

const project: Project = {
  id: "p1",
  workspaceId: "w1",
  name: "My Project",
  description: null,
  createdBy: null,
  origin: "user",
  createdAt: new Date("2024-01-02T03:04:05Z"),
  updatedAt: new Date("2024-02-03T04:05:06Z"),
  resourceCounts: {},
  notes: null,
  extraData: null,
};

const projectPage: ProjectPage = {
  items: [project],
  nextPageToken: null,
  totalCount: 1,
};

function makeClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function makeImpatientClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retryDelay: 0 },
      mutations: { retry: false },
    },
  });
}

function wrapperFor(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  backend = { configured: true, available: true };
});

describe("workspace query hooks", () => {
  it("useWorkspaces returns mapped list", async () => {
    vi.mocked(workspacesService.listWorkspaces).mockResolvedValue([workspace]);

    const { result } = renderHook(() => useWorkspaces(), {
      wrapper: wrapperFor(makeClient()),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([workspace]);
  });

  it("useWorkspace is disabled without an id", () => {
    const { result } = renderHook(() => useWorkspace(undefined), {
      wrapper: wrapperFor(makeClient()),
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(workspacesService.getWorkspace).not.toHaveBeenCalled();
  });

  it("useWorkspace fetches when given an id", async () => {
    vi.mocked(workspacesService.getWorkspace).mockResolvedValue(workspace);

    const { result } = renderHook(() => useWorkspace("w1"), {
      wrapper: wrapperFor(makeClient()),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(workspacesService.getWorkspace).toHaveBeenCalledWith("w1");
  });

  it("is disabled when the backend is unavailable", () => {
    backend = { configured: true, available: false };
    const { result } = renderHook(() => useWorkspaces(), {
      wrapper: wrapperFor(makeClient()),
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(workspacesService.listWorkspaces).not.toHaveBeenCalled();
  });
});

describe("project query hooks", () => {
  it("useProjects returns a page", async () => {
    vi.mocked(projectsService.listProjects).mockResolvedValue(projectPage);

    const { result } = renderHook(() => useProjects({ workspaceId: "w1" }), {
      wrapper: wrapperFor(makeClient()),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(projectsService.listProjects).toHaveBeenCalledWith({
      workspaceId: "w1",
    });
    expect(result.current.data).toEqual(projectPage);
  });

  it("useProject fetches by id", async () => {
    vi.mocked(projectsService.getProject).mockResolvedValue(project);

    const { result } = renderHook(() => useProject("p1"), {
      wrapper: wrapperFor(makeClient()),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(project);
  });

  it("useProject takes a 404 as the answer and does not ask again", async () => {
    vi.mocked(projectsService.getProject).mockRejectedValue(
      new ProjectsApiError("not found", 404),
    );

    const { result } = renderHook(() => useProject("missing"), {
      wrapper: wrapperFor(makeImpatientClient()),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(projectsService.getProject).toHaveBeenCalledTimes(1);
  });

  it("useProject asks again when the backend merely faltered", async () => {
    vi.mocked(projectsService.getProject).mockRejectedValue(
      new ProjectsApiError("gateway", 502),
    );

    const { result } = renderHook(() => useProject("p1"), {
      wrapper: wrapperFor(makeImpatientClient()),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(projectsService.getProject).toHaveBeenCalledTimes(4);
  });

  it("useProjects takes a refused list as the answer", async () => {
    vi.mocked(projectsService.listProjects).mockRejectedValue(
      new ProjectsApiError("forbidden", 403),
    );

    const { result } = renderHook(() => useProjects(), {
      wrapper: wrapperFor(makeImpatientClient()),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(projectsService.listProjects).toHaveBeenCalledTimes(1);
  });
});

describe("project mutation hooks", () => {
  it("useCreateProject invalidates the projects list on success", async () => {
    vi.mocked(projectsService.createProject).mockResolvedValue(project);
    const client = makeClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");

    const { result } = renderHook(() => useCreateProject(), {
      wrapper: wrapperFor(client),
    });

    await act(async () => {
      await result.current.mutateAsync({ workspaceId: "w1", name: "P" });
    });

    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["projects"] });
  });

  it("useUpdateProject invalidates list and detail", async () => {
    vi.mocked(projectsService.updateProject).mockResolvedValue(project);
    const client = makeClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");

    const { result } = renderHook(() => useUpdateProject(), {
      wrapper: wrapperFor(client),
    });

    await act(async () => {
      await result.current.mutateAsync({ id: "p1", input: { name: "New" } });
    });

    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["projects"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["projects", "p1"] });
  });

  it("useDeleteProject invalidates list and detail", async () => {
    vi.mocked(projectsService.deleteProject).mockResolvedValue({
      id: "p1",
      deletedResourceCounts: {},
      deletedResourceTotal: 0,
    });
    const client = makeClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");

    const { result } = renderHook(() => useDeleteProject(), {
      wrapper: wrapperFor(client),
    });

    await act(async () => {
      await result.current.mutateAsync("p1");
    });

    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["projects"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["projects", "p1"] });
  });
});
