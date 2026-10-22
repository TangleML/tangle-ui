import type {
  ListProjectResourcesParams,
  ProjectResourceSummary,
} from "./types";

export const PIPELINE_RESOURCE_PARAMS: ListProjectResourcesParams = {
  entity: ["pipeline"],
  pageSize: 100,
};

export function pipelineResourceIn(
  resources: readonly ProjectResourceSummary[],
  pipelineId: string,
) {
  return resources.find(
    (resource) =>
      resource.entity === "pipeline" && resource.entityId === pipelineId,
  );
}
