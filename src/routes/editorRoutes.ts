import { isFlagEnabled } from "@/components/shared/Settings/useFlags";

import { APP_ROUTES, EDITOR_PATH } from "./appRoutes";

function getLegacyEditorPath(pipelineName: string): string {
  return `${EDITOR_PATH}/${encodeURIComponent(pipelineName)}`;
}

function getEditorV2Path(pipelineName: string): string {
  return `${APP_ROUTES.EDITOR_V2}/${encodeURIComponent(pipelineName)}`;
}

export function getDefaultEditorPath(pipelineName: string): string {
  return isFlagEnabled("v2_editor")
    ? getEditorV2Path(pipelineName)
    : getLegacyEditorPath(pipelineName);
}
