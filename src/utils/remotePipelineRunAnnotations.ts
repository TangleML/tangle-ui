import {
  getDefaultEditorPath,
  getDefaultRemoteEditorPath,
} from "@/routes/editorRoutes";

import { REMOTE_PIPELINE_ID_ANNOTATION } from "./annotationKeys";

function stringAnnotation(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function remotePipelineIdFromRunAnnotations(
  annotations: Record<string, unknown> | null | undefined,
): string | undefined {
  if (!annotations) return undefined;

  return stringAnnotation(annotations[REMOTE_PIPELINE_ID_ANNOTATION]);
}

export function resolvePipelineInspectPath(
  annotations: Record<string, unknown> | null | undefined,
  pipelineName: string | null | undefined,
): string | undefined {
  const remotePipelineId = remotePipelineIdFromRunAnnotations(annotations);
  if (remotePipelineId) return getDefaultRemoteEditorPath(remotePipelineId);
  return pipelineName ? getDefaultEditorPath(pipelineName) : undefined;
}
