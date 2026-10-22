import { parseRemotePipelineSavedId } from "@/services/remotePipelineSavedLinks";

import { EDITOR_PATH } from "./appRoutes";

export function getDefaultEditorPath(pipelineId: string): string {
  return getDefaultRemoteEditorPath(
    getSavedRemotePipelineId(pipelineId) ?? pipelineId,
  );
}

function getSavedRemotePipelineId(id: string): string | undefined {
  return parseRemotePipelineSavedId(id)?.pipelineId;
}

export function getDefaultRemoteEditorPath(pipelineId: string): string {
  return `${EDITOR_PATH}/pipeline/${encodeURIComponent(pipelineId)}`;
}
