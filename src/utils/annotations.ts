import type { XYPosition } from "@xyflow/react";

import type { AnnotationConfig } from "@/types/annotations";

import type { ComponentSpec } from "./componentSpec";

export const DISPLAY_NAME_MAX_LENGTH = 100;
export const TASK_DISPLAY_NAME_ANNOTATION = "display_name";
export const PIPELINE_NOTES_ANNOTATION = "notes";
export const PIPELINE_RUN_NOTES_ANNOTATION = "notes";
export const PIPELINE_CANONICAL_NAME_ANNOTATION = "canonical-pipeline-name";
export const RUN_NAME_TEMPLATE_ANNOTATION = "run-name-template";
export const EDITOR_POSITION_ANNOTATION = "editor.position";
export const FLEX_NODES_ANNOTATION = "flex-nodes";

export const DEFAULT_COMMON_ANNOTATIONS: AnnotationConfig[] = [
  {
    annotation: EDITOR_POSITION_ANNOTATION,
    label: "Node position",
    type: "json",
  },
  {
    annotation: TASK_DISPLAY_NAME_ANNOTATION,
    label: "Display Name",
    type: "string",
    max: DISPLAY_NAME_MAX_LENGTH,
  },
];

type Annotations =
  | {
      [k: string]: unknown;
    }
  | undefined;

/**
 * Gets the value of an annotation.
 * @param annotations - The annotations object
 * @param key
 * @param defaultValue
 * @returns
 */
export function getAnnotationValue(
  annotations: Annotations | null,
  key: string,
  defaultValue: string,
): string;
export function getAnnotationValue(
  annotations: Annotations | null,
  key: string,
  defaultValue?: undefined,
): string | undefined;
export function getAnnotationValue(
  annotations: Annotations | null,
  key: string,
  defaultValue?: string,
) {
  if (!annotations) {
    return defaultValue;
  }

  return hasAnnotation(annotations, key) ? annotations?.[key] : defaultValue;
}

/**
 * Sets the value of an annotation.
 * @param annotations - The annotations object
 * @param key - The key of the annotation
 * @param value - The value to set
 * @returns
 */
function setAnnotation(
  annotations: Annotations,
  key: string,
  value: string | undefined,
) {
  return {
    ...(annotations ?? {}),
    [key]: value,
  };
}

/**
 * Checks if an annotation exists.
 * @param annotations - The annotations object
 * @param key - The key of the annotation
 * @returns boolean
 */
function hasAnnotation(
  annotations: Annotations,
  key: string,
): annotations is Annotations {
  if (!annotations) {
    return false;
  }

  return Object.prototype.hasOwnProperty.call(annotations, key);
}

/**
 * Sets an annotation on a ComponentSpec.
 * @param componentSpec - The ComponentSpec object
 * @param annotationKey - The key of the annotation
 * @param annotationValue - The value of the annotation
 * @returns componentSpec with updated annotation
 */
export const setComponentSpecAnnotation = (
  componentSpec: ComponentSpec,
  annotationKey: string,
  annotationValue: string | undefined,
) => {
  return {
    ...componentSpec,
    metadata: {
      ...componentSpec.metadata,
      annotations: setAnnotation(
        componentSpec.metadata?.annotations,
        annotationKey,
        annotationValue,
      ),
    },
  };
};

/**
 * Sets an annotation on a ComponentSpec.
 * @param annotations - The annotations object
 * @param position - The XY position to set
 * @returns updated annotations object
 */
export const setPositionInAnnotations = (
  annotations: Annotations,
  position: XYPosition,
): Annotations => {
  const updatedAnnotations = { ...annotations };

  let existingPosition: Record<string, number> = {};
  const editorPosition = getAnnotationValue(
    annotations,
    EDITOR_POSITION_ANNOTATION,
  );

  if (editorPosition) {
    try {
      existingPosition = JSON.parse(editorPosition);
    } catch {
      existingPosition = {};
    }
  }

  const newPosition = {
    ...existingPosition,
    x: position.x,
    y: position.y,
  };

  updatedAnnotations[EDITOR_POSITION_ANNOTATION] = JSON.stringify(newPosition);
  return updatedAnnotations;
};

/**
 * Sets an annotation on a ComponentSpec.
 * @param annotations - The annotations object
 * @returns XY position extracted from annotations
 */
export const extractPositionFromAnnotations = (
  annotations?: Annotations,
): XYPosition => {
  const defaultPosition: XYPosition = { x: 0, y: 0 };

  if (!annotations) return defaultPosition;

  try {
    const layoutAnnotation = getAnnotationValue(
      annotations,
      EDITOR_POSITION_ANNOTATION,
    );
    if (!layoutAnnotation) return defaultPosition;

    const decodedPosition = JSON.parse(layoutAnnotation);
    return {
      x: decodedPosition["x"] || 0,
      y: decodedPosition["y"] || 0,
    };
  } catch {
    return defaultPosition;
  }
};

/*
 * Ensures that the componentSpec has metadata and annotations objects.
 * @param componentSpec - The component specification
 * @returns The component specification with ensured metadata and annotations
 */
export function ensureAnnotations(
  componentSpec: ComponentSpec,
): ComponentSpec & {
  metadata: { annotations: Record<string, unknown> };
} {
  return {
    ...componentSpec,
    metadata: {
      ...componentSpec.metadata,
      annotations: {
        ...(componentSpec.metadata?.annotations ?? {}),
      },
    },
  };
}
