import type { LocalPipelinePointer } from "@/services/localPipelines/types";

import { localPipelinePointerOf } from "./resourceDescriptor";
import type {
  ListProjectResourcesParams,
  ProjectResourceSummary,
} from "./types";

export const PIPELINE_RESOURCE_PARAMS: ListProjectResourcesParams = {
  entity: ["pipeline", "document"],
  pageSize: 100,
};

/**
 * A pointer records the name a pipeline had when it was added, so a pipeline
 * renamed since is only recognised by the registry id the pointer carries
 * alongside it. A pipeline that never got an id and has been renamed cannot be
 * recognised at all, and is missing from the projects it is in.
 */
function pointsAt(
  resource: ProjectResourceSummary,
  pipeline: LocalPipelinePointer,
) {
  const pointer = localPipelinePointerOf(resource);
  if (!pointer) {
    return false;
  }
  if (pointer.localId && pipeline.localId) {
    return pointer.localId === pipeline.localId;
  }
  return pointer.localName === pipeline.localName;
}

export function pipelineResourceIn(
  resources: readonly ProjectResourceSummary[],
  pipeline: LocalPipelinePointer,
) {
  return resources.find((resource) => pointsAt(resource, pipeline));
}

export function holdsPipeline(
  resources: readonly ProjectResourceSummary[],
  pipeline: LocalPipelinePointer,
) {
  return pipelineResourceIn(resources, pipeline) !== undefined;
}
