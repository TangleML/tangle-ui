/**
 * Gets the value of an annotation.
 * @param annotations - The annotations object
 * @param key
 * @param defaultValue
 * @returns
 */
export function getAnnotationValue(
  annotations: Record<string, unknown> | undefined | null,
  key: string,
  defaultValue?: string,
) {
  return hasAnnotation(annotations, key)
    ? String(annotations[key])
    : defaultValue;
}

/**
 * Sets the value of an annotation.
 * @param annotations - The annotations object
 * @param key - The key of the annotation
 * @param value - The value to set
 * @returns
 */
export function setAnnotation(
  annotations: Record<string, unknown> | undefined | null,
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
  annotations: Record<string, unknown> | undefined | null,
  key: string,
): annotations is { [key: string]: unknown } {
  if (!annotations) {
    return false;
  }

  return Object.prototype.hasOwnProperty.call(annotations, key);
}

export const DISPLAY_NAME_MAX_LENGTH = 100;
export const TASK_DISPLAY_NAME_ANNOTATION = "display_name";
export const PIPELINE_NOTES_ANNOTATION = "notes";
export const PIPELINE_RUN_NOTES_ANNOTATION = "notes";
export const PIPELINE_CANONICAL_NAME_ANNOTATION = "canonical-pipeline-name";
