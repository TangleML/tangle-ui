import type { PipelineFile } from "@/services/pipelineStorage/PipelineFile";

import { ProjectResourcesApiError } from "./errors";
import { PIPELINE_RESOURCE_PARAMS } from "./pipelineProjects";
import { remotePipelineResourceInput } from "./pipelineResource";
import {
  createProjectResource,
  deleteProjectResource,
  listProjectResources,
} from "./projectResourcesService";
import { localPipelinePointerOf } from "./resourceDescriptor";
import type { ProjectResourceSummary } from "./types";

async function pipelineResources(projectId: string, backendUrl?: string) {
  const resources: ProjectResourceSummary[] = [];
  let pageToken: string | undefined;
  do {
    const page = await listProjectResources(
      projectId,
      {
        ...PIPELINE_RESOURCE_PARAMS,
        pageToken,
      },
      backendUrl,
    );
    resources.push(...page.items);
    pageToken = page.nextPageToken ?? undefined;
  } while (pageToken);
  return resources;
}

export async function moveLocalPipelineResourceToRemote(
  projectId: string,
  local: Pick<PipelineFile, "id" | "storageKey">,
  remote: Pick<PipelineFile, "id" | "storageKey">,
  backendUrl?: string,
): Promise<void> {
  if (!local.id) return;
  const resources = await pipelineResources(projectId, backendUrl);
  const localResources = resources.filter(
    (resource) => localPipelinePointerOf(resource)?.localId === local.id,
  );
  if (localResources.length === 0) return;
  const isRemote = (resource: ProjectResourceSummary) =>
    resource.entity === "pipeline" && resource.entityId === remote.id;
  if (!resources.some(isRemote)) {
    try {
      await createProjectResource(
        projectId,
        remotePipelineResourceInput(
          remote.id,
          localResources[0].name ?? remote.storageKey,
        ),
        backendUrl,
      );
    } catch (error) {
      if (
        !(error instanceof ProjectResourcesApiError) ||
        error.status !== 409 ||
        !(await pipelineResources(projectId, backendUrl)).some(isRemote)
      )
        throw error;
    }
  }
  for (const resource of localResources) {
    try {
      await deleteProjectResource(projectId, resource.id, backendUrl);
    } catch (error) {
      if (!(error instanceof ProjectResourcesApiError) || error.status !== 404)
        throw error;
    }
  }
}
