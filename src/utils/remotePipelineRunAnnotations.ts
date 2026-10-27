import {
  LEGACY_REMOTE_PIPELINE_ID_ANNOTATION,
  REMOTE_PIPELINE_ID_ANNOTATION,
} from "./annotationKeys";

function stringAnnotation(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function remotePipelineIdFromRunAnnotations(
  annotations: Record<string, unknown> | null | undefined,
): string | undefined {
  if (!annotations) return undefined;

  return (
    stringAnnotation(annotations[REMOTE_PIPELINE_ID_ANNOTATION]) ??
    stringAnnotation(annotations[LEGACY_REMOTE_PIPELINE_ID_ANNOTATION])
  );
}
