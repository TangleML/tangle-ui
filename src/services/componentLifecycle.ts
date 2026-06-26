import type { ComponentReference } from "@/utils/componentSpec";
import { isRecord } from "@/utils/typeGuards";

type ComponentLifecycleState = "deprecated" | "superseded";

export interface ComponentLifecycleInfo {
  state: ComponentLifecycleState;
  replacementDigest?: string;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function readBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return undefined;

  const normalized = value.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return undefined;
}

function readLifecycleState(
  value: unknown,
): ComponentLifecycleState | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === "deprecated") return "deprecated";
  if (normalized === "superseded") return "superseded";
  return undefined;
}

export function getComponentLifecycleInfo(
  reference: ComponentReference,
): ComponentLifecycleInfo | undefined {
  const annotations = reference.spec?.metadata?.annotations;
  const annotationLifecycleState = isRecord(annotations)
    ? readLifecycleState(
        annotations["lifecycle.state"] ??
          annotations["tangleml.com/lifecycle-state"],
      )
    : undefined;
  const replacementDigest = isRecord(annotations)
    ? (readString(annotations.superseded_by) ??
      readString(annotations.supersededBy) ??
      readString(annotations["tangleml.com/superseded-by"]) ??
      readString(reference.superseded_by))
    : readString(reference.superseded_by);

  if (replacementDigest) {
    return { state: "superseded", replacementDigest };
  }

  if (annotationLifecycleState === "superseded") {
    return { state: "superseded" };
  }

  const deprecated = isRecord(annotations)
    ? (readBoolean(annotations.deprecated) ?? reference.deprecated)
    : reference.deprecated;
  if (deprecated || annotationLifecycleState === "deprecated") {
    return { state: "deprecated" };
  }

  return undefined;
}
