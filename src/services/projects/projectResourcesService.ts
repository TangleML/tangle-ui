import {
  createResourceApiProjectsProjectIdResourcesPost,
  deleteResourceApiProjectsProjectIdResourcesResourceIdDelete,
  getResourceApiProjectsProjectIdResourcesResourceIdGet,
  listResourcesApiProjectsProjectIdResourcesGet,
  updateResourceApiProjectsProjectIdResourcesResourceIdPatch,
} from "@/api/sdk.gen";

import { ProjectResourcesApiError } from "./errors";
import { mapProjectResource, mapProjectResourceSummary } from "./mappers";
import type {
  CreateResourceInput,
  ListProjectResourcesParams,
  ProjectResource,
  ProjectResourcePage,
  UpdateResourceInput,
} from "./types";

export async function listProjectResources(
  projectId: string,
  params: ListProjectResourcesParams = {},
): Promise<ProjectResourcePage> {
  const result = await listResourcesApiProjectsProjectIdResourcesGet({
    path: { project_id: projectId },
    query: {
      entity: params.entity,
      page_token: params.pageToken,
      page_size: params.pageSize,
    },
  });
  if (!result.data) {
    throw new ProjectResourcesApiError(
      `Failed to list resources for project ${projectId}`,
      result.response.status,
    );
  }
  return {
    items: result.data.resources.map(mapProjectResourceSummary),
    nextPageToken: result.data.next_page_token ?? null,
    totalCount: result.data.total_count,
  };
}

export async function getProjectResource(
  projectId: string,
  resourceId: string,
): Promise<ProjectResource> {
  const result = await getResourceApiProjectsProjectIdResourcesResourceIdGet({
    path: { project_id: projectId, resource_id: resourceId },
  });
  if (!result.data) {
    throw new ProjectResourcesApiError(
      `Failed to fetch resource ${resourceId}`,
      result.response.status,
    );
  }
  return mapProjectResource(result.data);
}

export async function createProjectResource(
  projectId: string,
  input: CreateResourceInput,
): Promise<ProjectResource> {
  const result = await createResourceApiProjectsProjectIdResourcesPost({
    path: { project_id: projectId },
    body: {
      entity: input.entity,
      name: input.name,
      entity_id: input.entityId,
      payload: input.payload,
      extra_data: input.extraData,
    },
  });
  if (!result.data) {
    throw new ProjectResourcesApiError(
      `Failed to create resource for project ${projectId}`,
      result.response.status,
    );
  }
  return mapProjectResource(result.data);
}

export async function updateProjectResource(
  projectId: string,
  resourceId: string,
  input: UpdateResourceInput,
): Promise<ProjectResource> {
  const result =
    await updateResourceApiProjectsProjectIdResourcesResourceIdPatch({
      path: { project_id: projectId, resource_id: resourceId },
      body: {
        name: input.name,
        payload: input.payload,
        extra_data: input.extraData,
      },
    });
  if (!result.data) {
    throw new ProjectResourcesApiError(
      `Failed to update resource ${resourceId}`,
      result.response.status,
    );
  }
  return mapProjectResource(result.data);
}

export async function deleteProjectResource(
  projectId: string,
  resourceId: string,
): Promise<void> {
  const result =
    await deleteResourceApiProjectsProjectIdResourcesResourceIdDelete({
      path: { project_id: projectId, resource_id: resourceId },
    });
  if (!result.response.ok) {
    throw new ProjectResourcesApiError(
      `Failed to delete resource ${resourceId}`,
      result.response.status,
    );
  }
}
