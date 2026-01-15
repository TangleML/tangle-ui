import type { TaskSpecShape } from "@/components/shared/PipelineRunNameTemplate/types";

import { getAnnotationValue } from "./annotations";

/**
 * Extracts the canonical name from the task spec
 * @param taskSpec - The task spec to extract the canonical name from
 * @returns The canonical name
 */
export function extractCanonicalName(
  taskSpec: TaskSpecShape | undefined,
): string | undefined {
  return taskSpec
    ? getAnnotationValue(taskSpec.annotations, CANONICAL_NAME_ANNOTATION)
    : undefined;
}

/**
 * Builds annotations with the canonical name
 * @param canonicalName - The canonical name to build annotations with
 * @returns The annotations with the canonical name
 */
export function buildAnnotationsWithCanonicalName(
  canonicalName: string | undefined,
): Record<string, string> {
  if (!canonicalName) {
    return {};
  }

  return {
    [CANONICAL_NAME_ANNOTATION]: canonicalName,
  };
}

const CANONICAL_NAME_ANNOTATION = "canonical-pipeline-name";
