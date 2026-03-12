import type { XYPosition } from "@xyflow/react";

import {
  type ComponentSpec,
  IncrementingIdGenerator,
} from "@/models/componentSpec";
import {
  EDGE_CONDUITS_ANNOTATION,
  type EdgeConduit,
} from "@/models/componentSpec/annotations";

import { withUndoGroup } from "../../../store/undoStore";

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

const DEFAULT_SIZE = { width: 150, height: 30 };
const conduitIdGen = new IncrementingIdGenerator();

function nextConduitId(): string {
  return conduitIdGen.next("conduit");
}

function pickColor(existing: EdgeConduit[]): string {
  const usedColors = new Set(existing.map((c) => c.color));
  for (const color of DEFAULT_COLORS) {
    if (!usedColors.has(color)) return color;
  }
  return DEFAULT_COLORS[existing.length % DEFAULT_COLORS.length];
}

export function getConduits(spec: ComponentSpec): EdgeConduit[] {
  return spec.annotations.get("tangleml.com/editor/edge-conduits");
}

function setConduits(spec: ComponentSpec, conduits: EdgeConduit[]) {
  spec.setMetadata(EDGE_CONDUITS_ANNOTATION, conduits);
}

export function addConduit(
  spec: ComponentSpec,
  position: XYPosition,
): EdgeConduit {
  const existing = getConduits(spec);
  const conduit: EdgeConduit = {
    id: nextConduitId(),
    position,
    size: { ...DEFAULT_SIZE },
    color: pickColor(existing),
    edgeIds: [],
  };

  withUndoGroup("Add conduit", () => {
    setConduits(spec, [...existing, conduit]);
  });

  return conduit;
}

export function removeConduit(spec: ComponentSpec, conduitId: string) {
  const existing = getConduits(spec);
  const filtered = existing.filter((c) => c.id !== conduitId);

  console.log("removeConduit", conduitId, filtered.length, existing.length);
  if (filtered.length !== existing.length) {
    withUndoGroup("Remove conduit", () => {
      setConduits(spec, filtered);
    });
  }
}

export function updateConduitPosition(
  spec: ComponentSpec,
  conduitId: string,
  position: XYPosition,
) {
  const existing = getConduits(spec);
  const updated = existing.map((c) =>
    c.id === conduitId ? { ...c, position } : c,
  );
  withUndoGroup("Move conduit", () => {
    setConduits(spec, updated);
  });
}

export function updateConduitSize(
  spec: ComponentSpec,
  conduitId: string,
  size: { width: number; height: number },
  position: XYPosition,
) {
  const existing = getConduits(spec);
  const updated = existing.map((c) =>
    c.id === conduitId ? { ...c, size, position } : c,
  );
  withUndoGroup("Resize conduit", () => {
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
  withUndoGroup("Update conduit color", () => {
    setConduits(spec, updated);
  });
}

export function assignEdgeToConduit(
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
  withUndoGroup("Assign edge to conduit", () => {
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
  withUndoGroup("Unassign edge from conduit", () => {
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

/**
 * Build a lookup: bindingId -> ordered list of conduits for that edge.
 * Conduits are ordered by proximity from source position.
 */
export function buildEdgeConduitMap(
  conduits: EdgeConduit[],
  getSourcePosition: (bindingId: string) => XYPosition | undefined,
): Map<string, EdgeConduit[]> {
  const map = new Map<string, EdgeConduit[]>();

  for (const conduit of conduits) {
    for (const edgeId of conduit.edgeIds) {
      const list = map.get(edgeId);
      if (list) {
        list.push(conduit);
      } else {
        map.set(edgeId, [conduit]);
      }
    }
  }

  for (const [bindingId, conds] of map) {
    if (conds.length <= 1) continue;
    const srcPos = getSourcePosition(bindingId);
    if (!srcPos) continue;

    const center = (c: EdgeConduit) => ({
      x: c.position.x + c.size.width / 2,
      y: c.position.y + c.size.height / 2,
    });

    conds.sort((a, b) => {
      const ca = center(a);
      const cb = center(b);
      const distA = (ca.x - srcPos.x) ** 2 + (ca.y - srcPos.y) ** 2;
      const distB = (cb.x - srcPos.x) ** 2 + (cb.y - srcPos.y) ** 2;
      return distA - distB;
    });
  }

  return map;
}
