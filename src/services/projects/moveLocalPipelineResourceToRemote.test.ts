import { beforeEach, expect, it, vi } from "vitest";

import { ProjectResourcesApiError } from "./errors";
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

it("replaces only matching ID references and preserves ambiguous name-only references", async () => {
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

  expect(createProjectResource).toHaveBeenCalledExactlyOnceWith(
    "project-1",
    {
      entity: "pipeline",
      entityId: remote.id,
      name: "Project label",
    },
    undefined,
  );
  expect(vi.mocked(deleteProjectResource).mock.calls).toEqual([
    ["project-1", localResource.id, undefined],
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

  expect(listProjectResources).toHaveBeenNthCalledWith(
    2,
    "project-1",
    {
      ...PIPELINE_RESOURCE_PARAMS,
      pageToken: "page-2",
    },
    undefined,
  );
  expect(createProjectResource).not.toHaveBeenCalled();
  expect(deleteProjectResource).toHaveBeenCalledExactlyOnceWith(
    "project-1",
    localResource.id,
    undefined,
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

it("does not delete any resources for an unknown local ID", async () => {
  await moveLocalPipelineResourceToRemote(
    "project-1",
    { id: "", storageKey: local.storageKey },
    remote,
  );
  expect(listProjectResources).not.toHaveBeenCalled();
  expect(deleteProjectResource).not.toHaveBeenCalled();
});

it("recovers a concurrent create conflict only after verifying the same remote resource", async () => {
  vi.mocked(createProjectResource).mockRejectedValue(
    new ProjectResourcesApiError("Already exists", 409),
  );
  vi.mocked(listProjectResources)
    .mockResolvedValueOnce({
      items: [localResource],
      nextPageToken: null,
      totalCount: 1,
    })
    .mockResolvedValueOnce({
      items: [
        localResource,
        resource({ entity: "pipeline", entityId: remote.id }),
      ],
      nextPageToken: null,
      totalCount: 2,
    });
  await moveLocalPipelineResourceToRemote(
    "project-1",
    local,
    remote,
    "https://backend.example.com",
  );
  expect(deleteProjectResource).toHaveBeenCalledWith(
    "project-1",
    localResource.id,
    "https://backend.example.com",
  );
  expect(listProjectResources).toHaveBeenCalledWith(
    "project-1",
    expect.anything(),
    "https://backend.example.com",
  );
});

it("keeps local pointers for an unrelated conflict", async () => {
  vi.mocked(createProjectResource).mockRejectedValue(
    new ProjectResourcesApiError("Conflict", 409),
  );
  await expect(
    moveLocalPipelineResourceToRemote("project-1", local, remote),
  ).rejects.toThrow("Conflict");
  expect(deleteProjectResource).not.toHaveBeenCalled();
});

it("accepts an already-removed local pointer when another repair finished first", async () => {
  vi.mocked(deleteProjectResource).mockRejectedValue(
    new ProjectResourcesApiError("Gone", 404),
  );
  await expect(
    moveLocalPipelineResourceToRemote("project-1", local, remote),
  ).resolves.toBeUndefined();
});
