import {
  type ComponentSpec,
  IncrementingIdGenerator,
} from "@/models/componentSpec";
import type {
  EdgeConduit,
  GuidelineOrientation,
} from "@/models/componentSpec/annotations";
import { getConduits } from "@/routes/v2/shared/nodes/ConduitNode/conduit.utils";
import type { UndoGroupable } from "@/routes/v2/shared/nodes/types";

const DEFAULT_COLORS = [
  "#6366f1",
  "#f59e0b",
  "#10b981",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
  "#f97316",
  "#ec4899",
];

const guidelineIdGen = new IncrementingIdGenerator();

function nextGuidelineId(): string {
  return guidelineIdGen.next("conduit");
}

function pickColor(existing: EdgeConduit[]): string {
  const usedColors = new Set(existing.map((c) => c.color));
  for (const color of DEFAULT_COLORS) {
    if (!usedColors.has(color)) return color;
  }
  return DEFAULT_COLORS[existing.length % DEFAULT_COLORS.length];
}

export { getConduits } from "@/routes/v2/shared/nodes/ConduitNode/conduit.utils";

function setConduits(spec: ComponentSpec, conduits: EdgeConduit[]) {
  spec.setMetadata("tangleml.com/editor/edge-conduits", conduits);
}

export function addGuideline(
  undo: UndoGroupable,
  spec: ComponentSpec,
  orientation: GuidelineOrientation,
  coordinate: number,
): EdgeConduit {
  const existing = getConduits(spec);
  const guideline: EdgeConduit = {
    id: nextGuidelineId(),
    orientation,
    coordinate,
    color: pickColor(existing),
    edgeIds: [],
  };

  undo.withGroup("Add guideline", () => {
    setConduits(spec, [...existing, guideline]);
  });

  return guideline;
}

export function removeConduit(
  undo: UndoGroupable,
  spec: ComponentSpec,
  conduitId: string,
) {
  const existing = getConduits(spec);
  const filtered = existing.filter((c) => c.id !== conduitId);

  if (filtered.length !== existing.length) {
    undo.withGroup("Remove guideline", () => {
      setConduits(spec, filtered);
    });
  }
}

export function updateGuidelineCoordinate(
  undo: UndoGroupable,
  spec: ComponentSpec,
  conduitId: string,
  coordinate: number,
) {
  const existing = getConduits(spec);
  const updated = existing.map((c) =>
    c.id === conduitId ? { ...c, coordinate } : c,
  );
  undo.withGroup("Move guideline", () => {
    setConduits(spec, updated);
  });
}

export function updateConduitColor(
  undo: UndoGroupable,
  spec: ComponentSpec,
  conduitId: string,
  color: string,
) {
  const existing = getConduits(spec);
  const updated = existing.map((c) =>
    c.id === conduitId ? { ...c, color } : c,
  );
  undo.withGroup("Update guideline color", () => {
    setConduits(spec, updated);
  });
}

function assignEdgeToConduit(
  undo: UndoGroupable,
  spec: ComponentSpec,
  conduitId: string,
  bindingId: string,
) {
  const existing = getConduits(spec);
  const updated = existing.map((c) => {
    if (c.id !== conduitId) return c;
    if (c.edgeIds.includes(bindingId)) return c;
    return { ...c, edgeIds: [...c.edgeIds, bindingId] };
  });
  undo.withGroup("Assign edge to guideline", () => {
    setConduits(spec, updated);
  });
}

export function unassignEdgeFromConduit(
  undo: UndoGroupable,
  spec: ComponentSpec,
  conduitId: string,
  bindingId: string,
) {
  const existing = getConduits(spec);
  const updated = existing.map((c) => {
    if (c.id !== conduitId) return c;
    return { ...c, edgeIds: c.edgeIds.filter((id) => id !== bindingId) };
  });
  undo.withGroup("Unassign edge from guideline", () => {
    setConduits(spec, updated);
  });
}

export function toggleEdgeOnConduit(
  undo: UndoGroupable,
  spec: ComponentSpec,
  conduitId: string,
  bindingId: string,
) {
  const existing = getConduits(spec);
  const conduit = existing.find((c) => c.id === conduitId);
  if (!conduit) return;

  if (conduit.edgeIds.includes(bindingId)) {
    unassignEdgeFromConduit(undo, spec, conduitId, bindingId);
  } else {
    assignEdgeToConduit(undo, spec, conduitId, bindingId);
  }
}

export function cleanupDeletedBinding(
  undo: UndoGroupable,
  spec: ComponentSpec,
  bindingId: string,
) {
  const existing = getConduits(spec);
  const needsCleanup = existing.some((c) => c.edgeIds.includes(bindingId));
  if (!needsCleanup) return;

  const updated = existing.map((c) => ({
    ...c,
    edgeIds: c.edgeIds.filter((id) => id !== bindingId),
  }));
  undo.withGroup("Cleanup deleted binding", () => {
    setConduits(spec, updated);
  });
}

/**
 * Removes binding ids from conduit `edgeIds` in one metadata write.
 * Does not open an undo group — wrap the caller in `undo.withGroup` when needed.
 */
export function stripBindingIdsFromConduitMetadata(
  spec: ComponentSpec,
  bindingIds: string[],
): void {
  if (bindingIds.length === 0) return;
  const idSet = new Set(bindingIds);
  const existing = getConduits(spec);
  const needsUpdate = existing.some((c) =>
    c.edgeIds.some((id) => idSet.has(id)),
  );
  if (!needsUpdate) return;

  const updated = existing.map((c) => ({
    ...c,
    edgeIds: c.edgeIds.filter((id) => !idSet.has(id)),
  }));
  setConduits(spec, updated);
}
