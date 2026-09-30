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
import type {
  ProjectResource,
  ProjectResourcePage,
  ProjectResourceSummary,
} from "./types";
import { ProjectResourcesQueryKeys, ProjectRunsQueryKeys } from "./types";
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
  const listKey = ProjectResourcesQueryKeys.List("p1", { pageSize: 100 });
  const runsKey = ProjectRunsQueryKeys.List("p1");

  function clientHoldingAList(items: ProjectResourceSummary[]) {
    const client = makeClient();
    client.setQueryData(listKey, {
      items,
      nextPageToken: null,
      totalCount: items.length,
    });
    client.setQueryData(runsKey, {
      items: [],
      nextPageToken: null,
      totalCount: 0,
    });
    return client;
  }

  const page = (client: QueryClient) =>
    client.getQueryData<ProjectResourcePage>(listKey);

  it("useCreateProjectResource refreshes the resources and the project", async () => {
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
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ["projects", "p1"],
      exact: true,
    });
  });

  it("useUpdateProjectResource refreshes the resources and the project", async () => {
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
      queryKey: ["projects", "p1"],
      exact: true,
    });
  });

  /**
   * The row is gone before the request is: waiting for the delete and then a
   * re-read of the list is two round trips in which nothing visibly happens.
   */
  it("useDeleteProjectResource takes the row out before the request finishes", async () => {
    let finish = () => {};
    vi.mocked(projectResourcesService.deleteProjectResource).mockReturnValue(
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
    );
    const client = clientHoldingAList([
      { ...resource, id: "r1" },
      { ...resource, id: "r2" },
    ]);

    const { result } = renderHook(() => useDeleteProjectResource("p1"), {
      wrapper: wrapperFor(client),
    });

    await act(async () => {
      result.current.mutate("r1");
    });

    expect(page(client)?.items.map((item) => item.id)).toEqual(["r2"]);
    expect(page(client)?.totalCount).toBe(1);

    await act(async () => {
      finish();
    });
  });

  it("useDeleteProjectResource puts the row back when the request fails", async () => {
    vi.mocked(projectResourcesService.deleteProjectResource).mockRejectedValue(
      new Error("nope"),
    );
    const client = clientHoldingAList([
      { ...resource, id: "r1" },
      { ...resource, id: "r2" },
    ]);

    const { result } = renderHook(() => useDeleteProjectResource("p1"), {
      wrapper: wrapperFor(client),
    });

    await act(async () => {
      await result.current.mutateAsync("r1").catch(() => {});
    });

    expect(page(client)?.items.map((item) => item.id)).toEqual(["r1", "r2"]);
    expect(page(client)?.totalCount).toBe(2);
  });

  /**
   * The project's key is a prefix of its runs, so invalidating it loosely
   * re-reads the run feed — and the resource list a second time — for a change
   * that cannot have touched either.
   */
  it("useDeleteProjectResource leaves the run feed alone", async () => {
    vi.mocked(projectResourcesService.deleteProjectResource).mockResolvedValue(
      undefined,
    );
    const client = clientHoldingAList([{ ...resource, id: "r1" }]);

    const { result } = renderHook(() => useDeleteProjectResource("p1"), {
      wrapper: wrapperFor(client),
    });

    await act(async () => {
      await result.current.mutateAsync("r1");
    });

    expect(client.getQueryState(runsKey)?.isInvalidated).toBe(false);
  });
});
