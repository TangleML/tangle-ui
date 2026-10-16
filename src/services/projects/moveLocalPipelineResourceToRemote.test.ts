import { beforeEach, expect, it, vi } from "vitest";

import { moveLocalPipelineResourceToRemote } from "./moveLocalPipelineResourceToRemote";
import { PIPELINE_RESOURCE_PARAMS } from "./pipelineProjects";
import {
  createProjectResource,
  deleteProjectResource,
  listProjectResources,
} from "./projectResourcesService";
import { localPipelineResourceInput } from "./resourceDescriptor";
import type { ProjectResource } from "./types";

vi.mock("./projectResourcesService");

const local = { id: "local-1", storageKey: "Renamed pipeline" };
const remote = { id: "remote-1", storageKey: "Remote pipeline" };

function resource(overrides: Partial<ProjectResource> = {}): ProjectResource {
  return {
    id: "resource-1",
    projectId: "project-1",
    entity: "document",
    entityId: null,
    name: "Project label",
    metadata: null,
    payload: null,
    createdBy: null,
    createdAt: new Date("2026-10-01"),
    updatedAt: new Date("2026-10-01"),
    ...overrides,
  };
}

const localResource = resource({
  ...localPipelineResourceInput({
    localId: local.id,
    localName: "Original name",
  }),
  name: "Project label",
});

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(listProjectResources).mockResolvedValue({
    items: [localResource],
    nextPageToken: null,
    totalCount: 1,
  });
});

it("replaces matching ID and name references after creating the remote resource with the project label", async () => {
  vi.mocked(listProjectResources).mockResolvedValue({
    items: [
      localResource,
      resource({
        ...localPipelineResourceInput({ localName: local.storageKey }),
        id: "name-reference",
      }),
      resource({
        ...localPipelineResourceInput({
          localId: "different-id",
          localName: local.storageKey,
        }),
        id: "unrelated-reference",
      }),
    ],
    nextPageToken: null,
    totalCount: 3,
  });
  vi.mocked(createProjectResource).mockImplementation(async () => {
    expect(deleteProjectResource).not.toHaveBeenCalled();
    return resource({ entity: "pipeline", entityId: remote.id });
  });

  await moveLocalPipelineResourceToRemote("project-1", local, remote);

  expect(createProjectResource).toHaveBeenCalledExactlyOnceWith("project-1", {
    entity: "pipeline",
    entityId: remote.id,
    name: "Project label",
  });
  expect(vi.mocked(deleteProjectResource).mock.calls).toEqual([
    ["project-1", localResource.id],
    ["project-1", "name-reference"],
  ]);
});

it("reuses an existing remote association on a later page", async () => {
  vi.mocked(listProjectResources)
    .mockResolvedValueOnce({
      items: [localResource],
      nextPageToken: "page-2",
      totalCount: 2,
    })
    .mockResolvedValueOnce({
      items: [resource({ entity: "pipeline", entityId: remote.id })],
      nextPageToken: null,
      totalCount: 2,
    });

  await moveLocalPipelineResourceToRemote("project-1", local, remote);

  expect(listProjectResources).toHaveBeenNthCalledWith(2, "project-1", {
    ...PIPELINE_RESOURCE_PARAMS,
    pageToken: "page-2",
  });
  expect(createProjectResource).not.toHaveBeenCalled();
  expect(deleteProjectResource).toHaveBeenCalledExactlyOnceWith(
    "project-1",
    localResource.id,
  );
});

it("keeps local associations when creating the remote association fails", async () => {
  vi.mocked(createProjectResource).mockRejectedValue(
    new Error("Request failed"),
  );

  await expect(
    moveLocalPipelineResourceToRemote("project-1", local, remote),
  ).rejects.toThrow("Request failed");

  expect(deleteProjectResource).not.toHaveBeenCalled();
});

it("does not attach a pipeline that was not part of the project", async () => {
  vi.mocked(listProjectResources).mockResolvedValue({
    items: [],
    nextPageToken: null,
    totalCount: 0,
  });

  await moveLocalPipelineResourceToRemote("project-1", local, remote);

  expect(createProjectResource).not.toHaveBeenCalled();
  expect(deleteProjectResource).not.toHaveBeenCalled();
});
