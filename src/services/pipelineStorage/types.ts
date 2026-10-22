import { normalizeBackendUrl } from "@/utils/backendIdentity";

import { normalizePipelineId } from "../pipelineId";

export interface RemotePipelineRef {
  source: "remote";
  backendUrl: string;
  pipelineId: string;
}

export interface RemotePipelineDraftRef {
  source: "draft";
  backendUrl: string;
  draftId: string;
  name: string;
  provisionalName?: boolean;
}

export type EditorPipelineRef = RemotePipelineRef | RemotePipelineDraftRef;

export function isRemotePipelineDraftRef(
  ref: EditorPipelineRef,
): ref is RemotePipelineDraftRef {
  return ref.source === "draft";
}

export function getEditorPipelineIdentity(ref: EditorPipelineRef): string {
  return JSON.stringify([
    ref.source === "draft" ? "remote-pipeline-draft" : "remote-pipeline",
    normalizeBackendUrl(ref.backendUrl),
    ref.source === "draft" ? ref.draftId : normalizePipelineId(ref.pipelineId),
  ]);
}
