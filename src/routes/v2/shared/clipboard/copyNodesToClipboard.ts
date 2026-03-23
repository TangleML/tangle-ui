import type { ComponentSpec } from "@/models/componentSpec";
import type { NodeTypeRegistry } from "@/routes/v2/shared/nodes/registry";
import type {
  BindingSnapshot,
  NodeSnapshot,
} from "@/routes/v2/shared/nodes/types";
import type { SelectedNode } from "@/routes/v2/shared/store/editorStore";

import { writeToSystemClipboard } from "./clipboardEnvelope";
import { snapshotInternalBindings } from "./snapshotBindings";

export function copyNodesToClipboard(
  registry: NodeTypeRegistry,
  spec: ComponentSpec,
  selectedNodes: SelectedNode[],
): { snapshots: NodeSnapshot[]; bindings: BindingSnapshot[] } {
  const snapshots: NodeSnapshot[] = [];
  for (const node of selectedNodes) {
    const manifest = registry.get(node.type);
    const snapshot = manifest?.snapshotHandler?.snapshot(spec, node.id);
    if (snapshot) snapshots.push(snapshot);
  }

  const selectedIds = new Set(selectedNodes.map((n) => n.id));
  const bindings = snapshotInternalBindings(spec, selectedIds);

  writeToSystemClipboard(snapshots, bindings);
  return { snapshots, bindings };
}

export function computeSnapshotBounds(snapshots: NodeSnapshot[]): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  if (snapshots.length === 0) return { x: 0, y: 0, width: 0, height: 0 };

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const s of snapshots) {
    minX = Math.min(minX, s.position.x);
    minY = Math.min(minY, s.position.y);
    maxX = Math.max(maxX, s.position.x);
    maxY = Math.max(maxY, s.position.y);
  }

  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}
