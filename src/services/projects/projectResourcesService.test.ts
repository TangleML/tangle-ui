import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  ProjectResourceResponse,
  ProjectResourceSummaryResponse,
} from "@/api/types.gen";

vi.mock("@/api/sdk.gen");

import * as apiSdk from "@/api/sdk.gen";

import { ProjectResourcesApiError } from "./errors";
import {
  createProjectResource,
  deleteProjectResource,
  getProjectResource,
  listProjectResources,
  updateProjectResource,
} from "./projectResourcesService";

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

const resourceSummaryDto: ProjectResourceSummaryResponse = {
  id: "r1",
  project_id: "p1",
  entity: "pipeline",
  name: "Training run",
  entity_id: "pipe-9",
  extra_data: { pinned: true },
  created_by: "user@example.com",
  created_at: "2024-01-02T03:04:05Z",
  updated_at: "2024-02-03T04:05:06Z",
};

const resourceDto: ProjectResourceResponse = {
  ...resourceSummaryDto,
  payload: { note: "hello" },
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("projectResourcesService", () => {
  it("lists resources and maps pagination fields", async () => {
    vi.mocked(
      apiSdk.listResourcesApiProjectsProjectIdResourcesGet,
    ).mockResolvedValue(
      createMockApiResponse({
        resources: [resourceSummaryDto],
        total_count: 3,
        next_page_token: "tok-2",
      }),
    );

    const page = await listProjectResources("p1", {
      entity: ["pipeline"],
      pageSize: 20,
    });

    expect(
      apiSdk.listResourcesApiProjectsProjectIdResourcesGet,
    ).toHaveBeenCalledWith({
      path: { project_id: "p1" },
      query: {
        entity: ["pipeline"],
        page_token: undefined,
        page_size: 20,
      },
    });
    expect(page.totalCount).toBe(3);
    expect(page.nextPageToken).toBe("tok-2");
    expect(page.items[0]).toEqual({
      id: "r1",
      projectId: "p1",
      entity: "pipeline",
      name: "Training run",
      entityId: "pipe-9",
      extraData: { pinned: true },
      createdBy: "user@example.com",
      createdAt: new Date("2024-01-02T03:04:05Z"),
      updatedAt: new Date("2024-02-03T04:05:06Z"),
    });
  });

  it("defaults nextPageToken to null when absent", async () => {
    vi.mocked(
      apiSdk.listResourcesApiProjectsProjectIdResourcesGet,
    ).mockResolvedValue(
      createMockApiResponse({
        resources: [],
        total_count: 0,
      }),
    );

    const page = await listProjectResources("p1");

    expect(page.nextPageToken).toBeNull();
    expect(page.items).toEqual([]);
  });

  it("fetches a single resource including payload", async () => {
    vi.mocked(
      apiSdk.getResourceApiProjectsProjectIdResourcesResourceIdGet,
    ).mockResolvedValue(createMockApiResponse(resourceDto));

    const resource = await getProjectResource("p1", "r1");

    expect(
      apiSdk.getResourceApiProjectsProjectIdResourcesResourceIdGet,
    ).toHaveBeenCalledWith({
      path: { project_id: "p1", resource_id: "r1" },
    });
    expect(resource.payload).toEqual({ note: "hello" });
  });

  it("creates a resource mapping input to the request body", async () => {
    vi.mocked(
      apiSdk.createResourceApiProjectsProjectIdResourcesPost,
    ).mockResolvedValue(createMockApiResponse(resourceDto, 201));

    const resource = await createProjectResource("p1", {
      entity: "pipeline",
      name: "Training run",
      entityId: "pipe-9",
      payload: { note: "hello" },
      extraData: { pinned: true },
    });

    expect(
      apiSdk.createResourceApiProjectsProjectIdResourcesPost,
    ).toHaveBeenCalledWith({
      path: { project_id: "p1" },
      body: {
        entity: "pipeline",
        name: "Training run",
        entity_id: "pipe-9",
        payload: { note: "hello" },
        extra_data: { pinned: true },
      },
    });
    expect(resource.id).toBe("r1");
    expect(resource.extraData).toEqual({ pinned: true });
  });

  it("updates a resource", async () => {
    vi.mocked(
      apiSdk.updateResourceApiProjectsProjectIdResourcesResourceIdPatch,
    ).mockResolvedValue(createMockApiResponse(resourceDto));

    const resource = await updateProjectResource("p1", "r1", {
      name: "Renamed",
    });

    expect(
      apiSdk.updateResourceApiProjectsProjectIdResourcesResourceIdPatch,
    ).toHaveBeenCalledWith({
      path: { project_id: "p1", resource_id: "r1" },
      body: { name: "Renamed", payload: undefined, extra_data: undefined },
    });
    expect(resource.id).toBe("r1");
  });

  it("deletes a resource on 204 No Content", async () => {
    vi.mocked(
      apiSdk.deleteResourceApiProjectsProjectIdResourcesResourceIdDelete,
    ).mockResolvedValue(createMockApiResponse(undefined, 204));

    await expect(deleteProjectResource("p1", "r1")).resolves.toBeUndefined();
    expect(
      apiSdk.deleteResourceApiProjectsProjectIdResourcesResourceIdDelete,
    ).toHaveBeenCalledWith({
      path: { project_id: "p1", resource_id: "r1" },
    });
  });

  it("throws ProjectResourcesApiError with status on non-2xx", async () => {
    vi.mocked(
      apiSdk.getResourceApiProjectsProjectIdResourcesResourceIdGet,
    ).mockResolvedValue(createMockApiErrorResponse(404));

    await expect(getProjectResource("p1", "missing")).rejects.toBeInstanceOf(
      ProjectResourcesApiError,
    );
    await expect(getProjectResource("p1", "missing")).rejects.toMatchObject({
      status: 404,
    });
  });

  it("throws ProjectResourcesApiError when delete fails", async () => {
    vi.mocked(
      apiSdk.deleteResourceApiProjectsProjectIdResourcesResourceIdDelete,
    ).mockResolvedValue(createMockApiErrorResponse(409));

    await expect(deleteProjectResource("p1", "r1")).rejects.toMatchObject({
      status: 409,
    });
  });
});
