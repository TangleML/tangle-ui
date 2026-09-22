import { isFlagEnabled } from "@/components/shared/Settings/useFlags";
import type { PipelineFile } from "@/services/pipelineStorage/PipelineFile";
import { parseRemotePipelineReference } from "@/services/pipelineStorage/remotePipelineRecovery";
import type { PipelineRef } from "@/services/pipelineStorage/types";
import { REMOTE_PIPELINES_ENABLED } from "@/utils/remotePipelines";

import { APP_ROUTES, EDITOR_PATH } from "./appRoutes";

function getLegacyEditorPath(pipelineName: string): string {
  return `${EDITOR_PATH}/${encodeURIComponent(pipelineName)}`;
}

function getEditorPipelineName(
  referenceId: string,
  backendUrl?: string,
): string {
  const remote = parseRemotePipelineReference(referenceId);
  return remote &&
    (backendUrl === undefined ||
      remote.backendUrl === backendUrl.replace(/\/+$/, ""))
    ? remote.pipelineId
    : referenceId;
}

export function getEditorLocation(
  pipeline:
    Pick<PipelineFile, "referenceId" | "storageKind" | "id"> | PipelineRef,
) {
  const referenceId =
    "referenceId" in pipeline
      ? pipeline.referenceId
      : pipeline.fileId?.startsWith("remote:") ||
          pipeline.fileId?.startsWith("pending:")
        ? pipeline.fileId
        : pipeline.name;
  const fileId =
    "referenceId" in pipeline
      ? pipeline.storageKind === "local"
        ? pipeline.id
        : undefined
      : pipeline.fileId;
  const isRemote =
    referenceId.startsWith("remote:") || referenceId.startsWith("pending:");
  return {
    to: APP_ROUTES.EDITOR_V2_PIPELINE,
    params: { pipelineName: getEditorPipelineName(referenceId) },
    search: isRemote ? {} : { fileId },
  };
}

export function getDefaultEditorPath(
  pipelineName: string,
  backendUrl?: string,
): string {
  return REMOTE_PIPELINES_ENABLED ||
    pipelineName.startsWith("remote:") ||
    pipelineName.startsWith("pending:") ||
    isFlagEnabled("v2_editor")
    ? `${APP_ROUTES.EDITOR_V2}/${encodeURIComponent(getEditorPipelineName(pipelineName, backendUrl))}`
    : getLegacyEditorPath(pipelineName);
}
