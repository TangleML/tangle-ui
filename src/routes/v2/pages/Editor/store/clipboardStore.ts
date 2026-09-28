import type { XYPosition } from "@xyflow/react";
import {
  action,
  computed,
  makeObservable,
  observable,
  runInAction,
} from "mobx";

import type { ComponentSpec } from "@/models/componentSpec";
import { IncrementingIdGenerator } from "@/models/componentSpec/factories/idGenerator";
import { editorRegistry } from "@/routes/v2/pages/Editor/nodes";
import {
  readSystemClipboardInfo,
  type SystemClipboardInfo,
  writeToSystemClipboard,
} from "@/routes/v2/shared/clipboard/clipboardEnvelope";
import {
  collectNodeSnapshots,
  computeSnapshotBounds,
} from "@/routes/v2/shared/clipboard/copyNodesToClipboard";
import type {
  BindingSnapshot,
  NodeSnapshot,
  UndoGroupable,
} from "@/routes/v2/shared/nodes/types";
import type { SelectedNode } from "@/routes/v2/shared/store/editorStore";

import { cloneSnapshotsWithBindings } from "./clipboardStore.helpers";

const PASTE_OFFSET = 50;

const idGen = new IncrementingIdGenerator();

export class ClipboardStore {
  @observable.shallow accessor snapshots: NodeSnapshot[] = [];
  @observable.shallow accessor bindingSnapshots: BindingSnapshot[] = [];
  @observable accessor pasteOffsetIndex: number = 0;

  constructor(private undoStore: UndoGroupable) {
    makeObservable(this);
  }

  @computed get hasContent(): boolean {
    return this.snapshots.length > 0;
  }

  /** Rejects when the system clipboard write fails; the in-memory copy stands. */
  async copy(
    spec: ComponentSpec,
    selectedNodes: SelectedNode[],
  ): Promise<void> {
    const { snapshots, bindings } = collectNodeSnapshots(
      editorRegistry,
      spec,
      selectedNodes,
    );
    this.stage(snapshots, bindings);
    await writeToSystemClipboard(snapshots, bindings);
  }

  /**
   * `pasteEventRead` is authoritative when present: skipping the async read is
   * what avoids the clipboard-read permission prompt.
   *
   * Rejects when the clipboard is unreadable and nothing is staged in memory.
   * A readable clipboard holding no nodes resolves silently — pasting ordinary
   * text over the canvas should not nag.
   */
  async paste(
    spec: ComponentSpec,
    centerPosition: XYPosition,
    pasteEventRead?: SystemClipboardInfo,
  ): Promise<void> {
    const read =
      !pasteEventRead || pasteEventRead.kind === "unavailable"
        ? await readSystemClipboardInfo()
        : pasteEventRead;

    const envelope = read.kind === "envelope" ? read.envelope : null;
    const snapshots = envelope?.snapshots ?? this.snapshots;
    const bindings = envelope?.bindings ?? this.bindingSnapshots;

    if (snapshots.length === 0) {
      if (read.kind === "unavailable") {
        throw new Error("The system clipboard could not be read.");
      }
      return;
    }

    const offset = this.pasteOffsetIndex * PASTE_OFFSET;
    this.cloneSnapshotsAtPosition(spec, snapshots, bindings, {
      x: centerPosition.x + offset,
      y: centerPosition.y + offset,
    });

    runInAction(() => {
      this.pasteOffsetIndex += 1;
    });
  }

  duplicate(spec: ComponentSpec, selectedNodes: SelectedNode[]): string[] {
    const { snapshots, bindings } = collectNodeSnapshots(
      editorRegistry,
      spec,
      selectedNodes,
    );

    if (snapshots.length === 0) return [];

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
    this.pasteOffsetIndex = 0;
  }

  @action private stage(
    snapshots: NodeSnapshot[],
    bindings: BindingSnapshot[],
  ) {
    this.snapshots = snapshots;
    this.bindingSnapshots = bindings;
    this.pasteOffsetIndex = 0;
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
