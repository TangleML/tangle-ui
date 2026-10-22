import { isFlagEnabled } from "@/components/shared/Settings/useFlags";
import { parseRemotePipelineSavedId } from "@/services/remotePipelineSavedLinks";

import { APP_ROUTES, EDITOR_PATH } from "./appRoutes";

function getLegacyEditorPath(pipelineName: string): string {
  return `${EDITOR_PATH}/${encodeURIComponent(pipelineName)}`;
}

function getEditorV2Path(pipelineName: string): string {
  return `${APP_ROUTES.EDITOR_V2}/${encodeURIComponent(pipelineName)}`;
}

export function getDefaultEditorPath(pipelineName: string): string {
  const remoteId = getSavedRemotePipelineId(pipelineName);
  if (remoteId) return getDefaultRemoteEditorPath(remoteId);

  return isFlagEnabled("v2_editor")
    ? getEditorV2Path(pipelineName)
    : getLegacyEditorPath(pipelineName);
}

export function getSavedRemotePipelineId(id: string): string | undefined {
  return parseRemotePipelineSavedId(id)?.pipelineId;
}

export function getDefaultRemoteEditorPath(pipelineId: string): string {
  const editorPath = isFlagEnabled("v2_editor")
    ? APP_ROUTES.EDITOR_V2
    : EDITOR_PATH;
  return `${editorPath}/pipeline/${encodeURIComponent(pipelineId)}`;
}
