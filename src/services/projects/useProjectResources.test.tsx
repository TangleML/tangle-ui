import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./projectResourcesService");

let backend = { configured: true, available: true };
vi.mock("@/providers/BackendProvider", () => ({
  useBackend: () => backend,
}));

import * as projectResourcesService from "./projectResourcesService";
import type { ProjectResource, ProjectResourcePage } from "./types";
import {
  useCreateProjectResource,
  useDeleteProjectResource,
  useProjectResource,
  useProjectResources,
  useUpdateProjectResource,
} from "./useProjectResources";

const resource: ProjectResource = {
  id: "r1",
  projectId: "p1",
  entity: "pipeline",
  name: "Training run",
  entityId: "pipe-9",
  extraData: null,
  createdBy: null,
  createdAt: new Date("2024-01-02T03:04:05Z"),
  updatedAt: new Date("2024-02-03T04:05:06Z"),
  payload: null,
};

const resourcePage: ProjectResourcePage = {
  items: [resource],
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

describe("project resource query hooks", () => {
  it("useProjectResources returns a page", async () => {
    vi.mocked(projectResourcesService.listProjectResources).mockResolvedValue(
      resourcePage,
    );

    const { result } = renderHook(
      () => useProjectResources("p1", { entity: ["pipeline"] }),
      { wrapper: wrapperFor(makeClient()) },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(projectResourcesService.listProjectResources).toHaveBeenCalledWith(
      "p1",
      { entity: ["pipeline"] },
    );
    expect(result.current.data).toEqual(resourcePage);
  });

  it("useProjectResources is disabled without a project id", () => {
    const { result } = renderHook(() => useProjectResources(undefined), {
      wrapper: wrapperFor(makeClient()),
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(projectResourcesService.listProjectResources).not.toHaveBeenCalled();
  });

  it("useProjectResource fetches by id", async () => {
    vi.mocked(projectResourcesService.getProjectResource).mockResolvedValue(
      resource,
    );

    const { result } = renderHook(() => useProjectResource("p1", "r1"), {
      wrapper: wrapperFor(makeClient()),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(projectResourcesService.getProjectResource).toHaveBeenCalledWith(
      "p1",
      "r1",
    );
    expect(result.current.data).toEqual(resource);
  });

  it("useProjectResource is disabled without a resource id", () => {
    const { result } = renderHook(() => useProjectResource("p1", undefined), {
      wrapper: wrapperFor(makeClient()),
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(projectResourcesService.getProjectResource).not.toHaveBeenCalled();
  });
});

describe("project resource mutation hooks", () => {
  it("useCreateProjectResource invalidates resources and project detail", async () => {
    vi.mocked(projectResourcesService.createProjectResource).mockResolvedValue(
      resource,
    );
    const client = makeClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");

    const { result } = renderHook(() => useCreateProjectResource("p1"), {
      wrapper: wrapperFor(client),
    });

    await act(async () => {
      await result.current.mutateAsync({ entity: "pipeline" });
    });

    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ["projects", "p1", "resources"],
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["projects", "p1"] });
  });

  it("useUpdateProjectResource invalidates list and detail", async () => {
    vi.mocked(projectResourcesService.updateProjectResource).mockResolvedValue(
      resource,
    );
    const client = makeClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");

    const { result } = renderHook(() => useUpdateProjectResource("p1"), {
      wrapper: wrapperFor(client),
    });

    await act(async () => {
      await result.current.mutateAsync({
        resourceId: "r1",
        input: { name: "New" },
      });
    });

    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ["projects", "p1", "resources"],
    });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ["projects", "p1", "resources", "r1"],
    });
  });

  it("useDeleteProjectResource invalidates resources and project detail", async () => {
    vi.mocked(projectResourcesService.deleteProjectResource).mockResolvedValue(
      undefined,
    );
    const client = makeClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");

    const { result } = renderHook(() => useDeleteProjectResource("p1"), {
      wrapper: wrapperFor(client),
    });

    await act(async () => {
      await result.current.mutateAsync("r1");
    });

    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ["projects", "p1", "resources"],
    });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ["projects", "p1", "resources", "r1"],
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["projects", "p1"] });
  });
});
