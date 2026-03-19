import {
  type ComponentSpec,
  IncrementingIdGenerator,
} from "@/models/componentSpec";
import type {
  EdgeConduit,
  GuidelineOrientation,
} from "@/models/componentSpec/annotations";
import { withUndoGroup } from "@/routes/v2/pages/Editor/store/undoStore";
import { getConduits } from "@/routes/v2/shared/nodes/ConduitNode/conduit.utils";

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

  withUndoGroup("Add guideline", () => {
    setConduits(spec, [...existing, guideline]);
  });

  return guideline;
}

export function removeConduit(spec: ComponentSpec, conduitId: string) {
  const existing = getConduits(spec);
  const filtered = existing.filter((c) => c.id !== conduitId);

  if (filtered.length !== existing.length) {
    withUndoGroup("Remove guideline", () => {
      setConduits(spec, filtered);
    });
  }
}

export function updateGuidelineCoordinate(
  spec: ComponentSpec,
  conduitId: string,
  coordinate: number,
) {
  const existing = getConduits(spec);
  const updated = existing.map((c) =>
    c.id === conduitId ? { ...c, coordinate } : c,
  );
  withUndoGroup("Move guideline", () => {
    setConduits(spec, updated);
  });
}

export function updateConduitColor(
  spec: ComponentSpec,
  conduitId: string,
  color: string,
) {
  const existing = getConduits(spec);
  const updated = existing.map((c) =>
    c.id === conduitId ? { ...c, color } : c,
  );
  withUndoGroup("Update guideline color", () => {
    setConduits(spec, updated);
  });
}

function assignEdgeToConduit(
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
  withUndoGroup("Assign edge to guideline", () => {
    setConduits(spec, updated);
  });
}

export function unassignEdgeFromConduit(
  spec: ComponentSpec,
  conduitId: string,
  bindingId: string,
) {
  const existing = getConduits(spec);
  const updated = existing.map((c) => {
    if (c.id !== conduitId) return c;
    return { ...c, edgeIds: c.edgeIds.filter((id) => id !== bindingId) };
  });
  withUndoGroup("Unassign edge from guideline", () => {
    setConduits(spec, updated);
  });
}

export function toggleEdgeOnConduit(
  spec: ComponentSpec,
  conduitId: string,
  bindingId: string,
) {
  const existing = getConduits(spec);
  const conduit = existing.find((c) => c.id === conduitId);
  if (!conduit) return;

  if (conduit.edgeIds.includes(bindingId)) {
    unassignEdgeFromConduit(spec, conduitId, bindingId);
  } else {
    assignEdgeToConduit(spec, conduitId, bindingId);
  }
}

export function cleanupDeletedBinding(spec: ComponentSpec, bindingId: string) {
  const existing = getConduits(spec);
  const needsCleanup = existing.some((c) => c.edgeIds.includes(bindingId));
  if (!needsCleanup) return;

  const updated = existing.map((c) => ({
    ...c,
    edgeIds: c.edgeIds.filter((id) => id !== bindingId),
  }));
  withUndoGroup("Cleanup deleted binding", () => {
    setConduits(spec, updated);
  });
}
