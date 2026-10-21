import { EDITOR_PATH } from "./appRoutes";

export function getDefaultEditorPath(pipelineName: string): string {
  return `${EDITOR_PATH}/${encodeURIComponent(pipelineName)}`;
}
