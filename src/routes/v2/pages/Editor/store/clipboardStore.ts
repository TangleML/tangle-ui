import type { XYPosition } from "@xyflow/react";
import { action, computed, makeObservable, observable } from "mobx";

import type { ComponentSpec } from "@/models/componentSpec";
import { IncrementingIdGenerator } from "@/models/componentSpec/factories/idGenerator";
import {
  readFromSystemClipboard,
  writeToSystemClipboard,
} from "@/routes/v2/shared/clipboard/clipboardEnvelope";
import { computeSnapshotBounds } from "@/routes/v2/shared/clipboard/copyNodesToClipboard";
import { snapshotInternalBindings } from "@/routes/v2/shared/clipboard/snapshotBindings";
import type {
  BindingSnapshot,
  NodeSnapshot,
  UndoGroupable,
} from "@/routes/v2/shared/nodes/types";
import type { SelectedNode } from "@/routes/v2/shared/store/editorStore";

import { editorRegistry } from "../nodes";
import { cloneSnapshotsWithBindings } from "./clipboardStore.helpers";

const PASTE_OFFSET = 50;

const idGen = new IncrementingIdGenerator();

export class ClipboardStore {
  @observable.shallow accessor snapshots: NodeSnapshot[] = [];
  @observable.shallow accessor bindingSnapshots: BindingSnapshot[] = [];

  constructor(private undoStore: UndoGroupable) {
    makeObservable(this);
  }

  @computed get hasContent(): boolean {
    return this.snapshots.length > 0;
  }

  @action copy(spec: ComponentSpec, selectedNodes: SelectedNode[]) {
    const snapshots: NodeSnapshot[] = [];
    for (const node of selectedNodes) {
      const manifest = editorRegistry.get(node.type);
      const snapshot =
        manifest?.snapshotHandler?.snapshot(spec, node.id) ??
        manifest?.cloneHandler?.snapshot(spec, node.id);
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

    return this.cloneSnapshotsAtPosition(
      spec,
      snapshots,
      bindings,
      centerPosition,
    );
  }

  duplicate(spec: ComponentSpec, selectedNodes: SelectedNode[]): string[] {
    const snapshots: NodeSnapshot[] = [];
    for (const node of selectedNodes) {
      const manifest = editorRegistry.get(node.type);
      const snapshot =
        manifest?.snapshotHandler?.snapshot(spec, node.id) ??
        manifest?.cloneHandler?.snapshot(spec, node.id);
      if (snapshot) snapshots.push(snapshot);
    }

    if (snapshots.length === 0) return [];

    const selectedIds = new Set(selectedNodes.map((n) => n.id));
    const bindings = snapshotInternalBindings(spec, selectedIds);

    return cloneSnapshotsWithBindings(
      spec,
      snapshots,
      bindings,
      (s) => ({
        x: s.position.x + PASTE_OFFSET,
        y: s.position.y + PASTE_OFFSET,
      }),
      this.undoStore,
      idGen,
      "Duplicate nodes",
    );
  }

  @action clear() {
    this.snapshots = [];
    this.bindingSnapshots = [];
  }

  private cloneSnapshotsAtPosition(
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

    return cloneSnapshotsWithBindings(
      spec,
      snapshots,
      bindings,
      (s) => ({
        x: centerPosition.x + (s.position.x - snapshotCenter.x),
        y: centerPosition.y + (s.position.y - snapshotCenter.y),
      }),
      this.undoStore,
      idGen,
      "Paste nodes",
    );
  }
}
