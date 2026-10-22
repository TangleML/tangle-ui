import type { Annotations } from "@/types/annotations";

import {
  BACKEND_ANNOTATION_PREFIX,
  EDGE_CONDUITS_ANNOTATION,
  EDITOR_COLLAPSED_ANNOTATION,
  EDITOR_FLOW_DIRECTION_ANNOTATION,
  EDITOR_POSITION_ANNOTATION,
  FLEX_NODES_ANNOTATION,
  PIPELINE_NOTES_ANNOTATION,
  PIPELINE_RUN_NOTES_ANNOTATION,
  PIPELINE_TAGS_ANNOTATION,
  PROJECT_ID_ANNOTATION_PREFIX,
  RUN_NAME_TEMPLATE_ANNOTATION,
  RUN_SOURCE_ANNOTATION,
  SDK_ANNOTATION,
  TASK_COLOR_ANNOTATION,
} from "./annotationKeys";
import type { ComponentSpec } from "./componentSpec";

export * from "./annotationKeys";
const PIPELINE_AGGREGATOR_ANNOTATION = "is_input_aggregator";

export const SYSTEM_ANNOTATIONS = [
  PIPELINE_NOTES_ANNOTATION,
  PIPELINE_TAGS_ANNOTATION,
  RUN_NAME_TEMPLATE_ANNOTATION,
  FLEX_NODES_ANNOTATION,
  SDK_ANNOTATION,
  EDITOR_POSITION_ANNOTATION,
  EDITOR_COLLAPSED_ANNOTATION,
  EDITOR_FLOW_DIRECTION_ANNOTATION,
  TASK_COLOR_ANNOTATION,
  EDGE_CONDUITS_ANNOTATION,
];

const SYSTEM_RUN_ANNOTATIONS = [
  PIPELINE_RUN_NOTES_ANNOTATION,
  PIPELINE_TAGS_ANNOTATION,
  RUN_SOURCE_ANNOTATION,
];

const SYSTEM_RUN_ANNOTATION_PREFIXES = [
  BACKEND_ANNOTATION_PREFIX,
  PROJECT_ID_ANNOTATION_PREFIX,
];

export function isSystemRunAnnotation(key: string): boolean {
  return (
    SYSTEM_RUN_ANNOTATIONS.includes(key) ||
    SYSTEM_RUN_ANNOTATION_PREFIXES.some((prefix) => key.startsWith(prefix))
  );
}

/**
 * Gets the value of an annotation.
 * @param annotations - The annotations object
 * @param key
 * @param defaultValue
 * @returns
 */
export function getAnnotationValue(
  annotations: Annotations | null | undefined,
  key: string,
  defaultValue: string,
): string;
export function getAnnotationValue(
  annotations: Annotations | null | undefined,
  key: string,
  defaultValue?: undefined,
): string | undefined;
export function getAnnotationValue(
  annotations: Annotations | null | undefined,
  key: string,
  defaultValue?: string,
) {
  if (!annotations) {
    return defaultValue;
  }

  return hasAnnotation(annotations, key)
    ? (annotations[key] as string)
    : defaultValue;
}

/**
 * Checks if an annotation exists.
 * @param annotations - The annotations object
 * @param key - The key of the annotation
 * @returns boolean
 */
function hasAnnotation(
  annotations: Annotations | undefined,
  key: string,
): annotations is Annotations {
  if (!annotations) {
    return false;
  }

  return Object.prototype.hasOwnProperty.call(annotations, key);
}

/**
 * Extract the pipeline tags from a ComponentSpec's annotations.
 * @param componentSpec - The component specification
 * @returns The pipeline tags as an array of strings
 */
export function getPipelineTagsFromSpec(
  componentSpec?: ComponentSpec,
): string[] {
  if (!componentSpec) {
    return [];
  }

  const annotations = componentSpec.metadata?.annotations;

  return getPipelineTagsFromAnnotations(annotations);
}

/**
 * Extract the pipeline tags from annotations.
 * @param annotations - The annotations object
 * @returns The pipeline tags as an array of strings
 */
export function getPipelineTagsFromAnnotations(
  annotations?: Annotations,
): string[] {
  if (!annotations) {
    return [];
  }

  const tagsString =
    getAnnotationValue(annotations, PIPELINE_TAGS_ANNOTATION) ?? "";

  const tags = tagsString
    ? tagsString
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
    : [];

  return tags;
}

export const isPipelineAggregator = (annotations?: Annotations): boolean => {
  return (
    getAnnotationValue(annotations, PIPELINE_AGGREGATOR_ANNOTATION) === "true"
  );
};

export function buildProjectRunAnnotationKey(projectId: string): string {
  return `${PROJECT_ID_ANNOTATION_PREFIX}${projectId}`;
}
