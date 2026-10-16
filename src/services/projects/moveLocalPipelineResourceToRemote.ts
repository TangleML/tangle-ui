import type { PipelineFile } from "@/services/pipelineStorage/PipelineFile";

import { holdsPipeline, PIPELINE_RESOURCE_PARAMS } from "./pipelineProjects";
import { remotePipelineResourceInput } from "./pipelineResource";
import {
  createProjectResource,
  deleteProjectResource,
  listProjectResources,
} from "./projectResourcesService";
import type { ProjectResourceSummary } from "./types";

export async function moveLocalPipelineResourceToRemote(
  projectId: string,
  local: Pick<PipelineFile, "id" | "storageKey">,
  remote: Pick<PipelineFile, "id" | "storageKey">,
): Promise<void> {
  const resources: ProjectResourceSummary[] = [];
  let pageToken: string | undefined;
  do {
    const page = await listProjectResources(projectId, {
      ...PIPELINE_RESOURCE_PARAMS,
      pageToken,
    });
    resources.push(...page.items);
    pageToken = page.nextPageToken ?? undefined;
  } while (pageToken);

  const pointer = { localId: local.id, localName: local.storageKey };
  const localResources = resources.filter((resource) =>
    holdsPipeline([resource], pointer),
  );
  if (localResources.length === 0) return;

  if (
    !resources.some(
      (resource) =>
        resource.entity === "pipeline" && resource.entityId === remote.id,
    )
  ) {
    await createProjectResource(
      projectId,
      remotePipelineResourceInput(
        remote.id,
        localResources[0].name ?? remote.storageKey,
      ),
    );
  }
  for (const resource of localResources) {
    await deleteProjectResource(projectId, resource.id);
  }
}
