import { parseRemotePipelineSavedId } from "@/services/remotePipelineSavedLinks";

import { EDITOR_PATH } from "./appRoutes";

export function getDefaultEditorPath(pipelineName: string): string {
  const remoteId = getSavedRemotePipelineId(pipelineName);
  if (remoteId) return getDefaultRemoteEditorPath(remoteId);
  return `${EDITOR_PATH}/${encodeURIComponent(pipelineName)}`;
}

export function getSavedRemotePipelineId(id: string): string | undefined {
  return parseRemotePipelineSavedId(id)?.pipelineId;
}

export function getDefaultRemoteEditorPath(pipelineId: string): string {
  return `${EDITOR_PATH}/pipeline/${encodeURIComponent(pipelineId)}`;
}
