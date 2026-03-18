import "@/routes/EditorV2/nodes"; // ensure manifests are registered

import type { XYPosition } from "@xyflow/react";
import { action, computed, makeObservable, observable } from "mobx";

import type { ComponentSpec } from "@/models/componentSpec";
import { IncrementingIdGenerator } from "@/models/componentSpec/factories/idGenerator";
import { NODE_TYPE_REGISTRY } from "@/routes/EditorV2/nodes/registry";

import type { SelectedNode } from "./editorStore";
import {
  type BindingSnapshot,
  cloneBindings,
  type NodeSnapshot,
  snapshotInternalBindings,
} from "./nodeCloneHandlers";
import { withUndoGroup } from "./undoStore";

const PASTE_OFFSET = 50;
const CLIPBOARD_ENVELOPE_TYPE = "tangle-pipeline-nodes";

const idGen = new IncrementingIdGenerator();

interface ClipboardEnvelope {
  _type: typeof CLIPBOARD_ENVELOPE_TYPE;
  snapshots: NodeSnapshot[];
  bindings: BindingSnapshot[];
}

function isClipboardEnvelope(data: unknown): data is ClipboardEnvelope {
  return (
    typeof data === "object" &&
    data !== null &&
    "_type" in data &&
    (data as Record<string, unknown>)._type === CLIPBOARD_ENVELOPE_TYPE
  );
}

async function writeToSystemClipboard(
  snapshots: NodeSnapshot[],
  bindings: BindingSnapshot[],
) {
  try {
    const envelope: ClipboardEnvelope = {
      _type: CLIPBOARD_ENVELOPE_TYPE,
      snapshots,
      bindings,
    };
    await navigator.clipboard.writeText(JSON.stringify(envelope));
  } catch {
    // System clipboard may be unavailable (permissions, insecure context)
  }
}

async function readFromSystemClipboard(): Promise<ClipboardEnvelope | null> {
  try {
    const text = await navigator.clipboard.readText();
    const parsed = JSON.parse(text);
    if (isClipboardEnvelope(parsed)) return parsed;
  } catch {
    // Not pipeline data or clipboard unavailable
  }
  return null;
}

class ClipboardStore {
  @observable.shallow accessor snapshots: NodeSnapshot[] = [];
  @observable.shallow accessor bindingSnapshots: BindingSnapshot[] = [];

  constructor() {
    makeObservable(this);
  }

  @computed get hasContent(): boolean {
    return this.snapshots.length > 0;
  }

  @action copy(spec: ComponentSpec, selectedNodes: SelectedNode[]) {
    const snapshots: NodeSnapshot[] = [];

    for (const node of selectedNodes) {
      const manifest = NODE_TYPE_REGISTRY.get(node.type);
      const snapshot = manifest?.cloneHandler?.snapshot(spec, node.id);
      if (snapshot) snapshots.push(snapshot);
    }

    const selectedIds = new Set(selectedNodes.map((n) => n.id));
    const bindings = snapshotInternalBindings(spec, selectedIds);

    this.snapshots = snapshots;
    this.bindingSnapshots = bindings;

    writeToSystemClipboard(snapshots, bindings);
  }

  async paste(
    spec: ComponentSpec,
    centerPosition: XYPosition,
  ): Promise<string[]> {
    const systemData = await readFromSystemClipboard();
    const snapshots = systemData?.snapshots ?? this.snapshots;
    const bindings = systemData?.bindings ?? this.bindingSnapshots;

    if (snapshots.length === 0) return [];

    return cloneSnapshotsAtPosition(spec, snapshots, bindings, centerPosition);
  }

  duplicate(spec: ComponentSpec, selectedNodes: SelectedNode[]): string[] {
    const snapshots: NodeSnapshot[] = [];

    for (const node of selectedNodes) {
      const manifest = NODE_TYPE_REGISTRY.get(node.type);
      const snapshot = manifest?.cloneHandler?.snapshot(spec, node.id);
      if (snapshot) snapshots.push(snapshot);
    }

    if (snapshots.length === 0) return [];

    const selectedIds = new Set(selectedNodes.map((n) => n.id));
    const bindings = snapshotInternalBindings(spec, selectedIds);

    const newIds: string[] = [];
    const idMap = new Map<string, string>();

    withUndoGroup("Duplicate nodes", () => {
      for (const snapshot of snapshots) {
        const offsetPosition = {
          x: snapshot.position.x + PASTE_OFFSET,
          y: snapshot.position.y + PASTE_OFFSET,
        };

        const manifest = NODE_TYPE_REGISTRY.get(snapshot.type);
        const newId = manifest?.cloneHandler?.clone(
          spec,
          snapshot,
          idGen,
          offsetPosition,
        );

        if (newId) {
          idMap.set(snapshot.entityId, newId);
          newIds.push(newId);
        }
      }

      cloneBindings(spec, bindings, idMap, idGen);
    });

    return newIds;
  }

  @action clear() {
    this.snapshots = [];
    this.bindingSnapshots = [];
  }
}

function cloneSnapshotsAtPosition(
  spec: ComponentSpec,
  snapshots: NodeSnapshot[],
  bindings: BindingSnapshot[],
  centerPosition: XYPosition,
): string[] {
  const bounds = computeSnapshotBounds(snapshots);
  const snapshotCenter = {
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2,
  };

  const newIds: string[] = [];
  const idMap = new Map<string, string>();

  withUndoGroup("Paste nodes", () => {
    for (const snapshot of snapshots) {
      const offsetPosition = {
        x: centerPosition.x + (snapshot.position.x - snapshotCenter.x),
        y: centerPosition.y + (snapshot.position.y - snapshotCenter.y),
      };

      const manifest = NODE_TYPE_REGISTRY.get(snapshot.type);
      const newId = manifest?.cloneHandler?.clone(
        spec,
        snapshot,
        idGen,
        offsetPosition,
      );

      if (newId) {
        idMap.set(snapshot.entityId, newId);
        newIds.push(newId);
      }
    }

    cloneBindings(spec, bindings, idMap, idGen);
  });

  return newIds;
}

function computeSnapshotBounds(snapshots: NodeSnapshot[]): {
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

export const clipboardStore = new ClipboardStore();
