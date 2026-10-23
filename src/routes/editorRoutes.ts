import { EDITOR_PATH } from "./appRoutes";

export function getDefaultEditorPath(pipelineName: string): string {
  return `${EDITOR_PATH}/${encodeURIComponent(pipelineName)}`;
}

export function getDefaultRemoteEditorPath(pipelineId: string): string {
  return `${EDITOR_PATH}/pipeline/${encodeURIComponent(pipelineId)}`;
}
