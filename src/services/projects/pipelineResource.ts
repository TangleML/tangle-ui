import { normalizePipelineId } from "@/services/pipelineId";
import type { PipelineFile } from "@/services/pipelineStorage/PipelineFile";

import { localPipelineResourceInput } from "./resourceDescriptor";
import {
  draftPipelineIdentity,
  idIdentity,
  remotePipelineIdentity,
  type WorkareaTarget,
} from "./resourceTarget";
import type { CreateResourceInput, ProjectResourceSummary } from "./types";

interface LocalProjectPipeline {
  source: "local";
  name: string;
}

interface RemoteProjectPipeline {
  source: "remote";
  pipelineId: string;
  name: string;
}

export type ProjectPipelineRef = LocalProjectPipeline | RemoteProjectPipeline;

export function localProjectPipeline(
  name: string | undefined,
): ProjectPipelineRef | undefined {
  return name ? { source: "local", name } : undefined;
}

/** A draft has no backend id until its first save, so nothing can point at it yet. */
export function projectPipelineOf(
  file: Pick<PipelineFile, "id" | "storageKey" | "remote" | "isDraft">,
): ProjectPipelineRef | undefined {
  if (file.remote) {
    return {
      source: "remote",
      pipelineId: normalizePipelineId(file.id),
      name: file.storageKey,
    };
  }
  return file.isDraft ? undefined : localProjectPipeline(file.storageKey);
}

export function pipelineFileTarget(file: PipelineFile): WorkareaTarget {
  return {
    type: "pipeline",
    identity: file.remote
      ? remotePipelineIdentity(file.id)
      : file.isDraft
        ? draftPipelineIdentity(file.initialId)
        : idIdentity(file.id),
  };
}

export function remotePipelineResourceInput(
  pipelineId: string,
  name: string,
): CreateResourceInput {
  return { entity: "pipeline", entityId: pipelineId, name };
}

export function pipelineFileResourceInput(
  file: PipelineFile,
): CreateResourceInput {
  return file.remote
    ? remotePipelineResourceInput(file.id, file.storageKey)
    : localPipelineResourceInput({
        localId: file.id,
        localName: file.storageKey,
      });
}

export function remoteResourceTarget(
  resource: Pick<ProjectResourceSummary, "entity" | "entityId">,
): WorkareaTarget | undefined {
  return resource.entity === "pipeline" && resource.entityId
    ? { type: "pipeline", identity: remotePipelineIdentity(resource.entityId) }
    : undefined;
}
