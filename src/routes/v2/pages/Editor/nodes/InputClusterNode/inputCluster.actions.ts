import type { XYPosition } from "@xyflow/react";

import type { ComponentSpec } from "@/models/componentSpec";
import type { InputClusterMeta } from "@/models/componentSpec/annotations";
import type { UndoGroupable } from "@/routes/v2/shared/nodes/types";
import { INPUT_CLUSTERS_ANNOTATION } from "@/utils/annotations";

/**
 * Cluster membership is derived from usage on every render, so only the manually
 * adjusted (or auto-laid-out) position is persisted, keyed by the deterministic
 * cluster id. Mirrors the flex-nodes annotation pattern.
 */
function getInputClusterPositions(spec: ComponentSpec): InputClusterMeta[] {
  return spec.annotations.get(INPUT_CLUSTERS_ANNOTATION);
}

export function setInputClusterPosition(
  undo: UndoGroupable,
  spec: ComponentSpec,
  clusterId: string,
  position: XYPosition,
) {
  undo.withGroup("Move input cluster", () => {
    const existing = getInputClusterPositions(spec);
    const next = existing.some((c) => c.id === clusterId)
      ? existing.map((c) => (c.id === clusterId ? { ...c, position } : c))
      : [...existing, { id: clusterId, position }];
    spec.annotations.set(INPUT_CLUSTERS_ANNOTATION, next);
  });
}

export function removeInputClusterPosition(
  undo: UndoGroupable,
  spec: ComponentSpec,
  clusterId: string,
) {
  undo.withGroup("Remove input cluster position", () => {
    const existing = getInputClusterPositions(spec);
    spec.annotations.set(
      INPUT_CLUSTERS_ANNOTATION,
      existing.filter((c) => c.id !== clusterId),
    );
  });
}
