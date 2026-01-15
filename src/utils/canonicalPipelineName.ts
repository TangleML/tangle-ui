import type { ComponentSpec } from "./componentSpec";

/**
 *
 * @param componentSpec - The component spec to extract the canonical name from
 * @returns The canonical name
 */
export function extractCanonicalName(
  componentSpec: ComponentSpec,
): string | undefined {
  return componentSpec.metadata?.annotations?.[CANONICAL_NAME_ANNOTATION] as
    | string
    | undefined;
}

/**
 * Sets the canonical name for a component spec
 * @param componentSpec - The component spec to set the canonical name for
 * @param canonicalName
 */
export function setCanonicalName(
  componentSpec: ComponentSpec,
  canonicalName: string | undefined,
) {
  if (!canonicalName) {
    return;
  }

  componentSpec.metadata = {
    ...componentSpec.metadata,
    annotations: {
      ...componentSpec.metadata?.annotations,
      [CANONICAL_NAME_ANNOTATION]: canonicalName,
    },
  };
}

const CANONICAL_NAME_ANNOTATION = "canonical-pipeline-name";
