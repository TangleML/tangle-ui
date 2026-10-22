import type { PipelineFile } from "@/services/pipelineStorage/PipelineFile";

import {
  draftPipelineIdentity,
  remotePipelineIdentity,
  type WorkareaTarget,
} from "./resourceTarget";
import type { CreateResourceInput, ProjectResourceSummary } from "./types";

export function pipelineFileTarget(file: PipelineFile): WorkareaTarget {
  return {
    type: "pipeline",
    identity: file.remote
      ? remotePipelineIdentity(file.id)
      : draftPipelineIdentity(file.initialId),
  };
}

export function remotePipelineResourceInput(
  pipelineId: string,
  name: string,
): CreateResourceInput {
  return { entity: "pipeline", entityId: pipelineId, name };
}

export function remoteResourceTarget(
  resource: Pick<ProjectResourceSummary, "entity" | "entityId">,
): WorkareaTarget | undefined {
  return resource.entity === "pipeline" && resource.entityId
    ? { type: "pipeline", identity: remotePipelineIdentity(resource.entityId) }
    : undefined;
}
