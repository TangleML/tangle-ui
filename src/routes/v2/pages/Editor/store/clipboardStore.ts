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
import {
  LINEAGE_EXCLUDE_ANNOTATION,
  LINEAGE_ORIGIN_ANNOTATION,
} from "@/utils/lineage";

import {
  type CloneResult,
  cloneSnapshotsWithBindings,
} from "./clipboardStore.helpers";

/** The source→destination id mapping from the most recent paste or duplicate. */
export interface PasteContext {
  /** Maps source task entityId → newly created task id. */
  idMap: CloneResult["idMap"];
}

/**
 * Pending copy context: the clipboard write is deferred while the
 * CopyLineageModal is open so the user can decide whether to link the
 * original task before the copy is committed to the clipboard.
 */
export interface CopyContext {
  /** Source task ids that have no lineage annotation. */
  nodeIds: string[];
}

const PASTE_OFFSET = 50;

const idGen = new IncrementingIdGenerator();

export class ClipboardStore {
  @observable.shallow accessor snapshots: NodeSnapshot[] = [];
  @observable.shallow accessor bindingSnapshots: BindingSnapshot[] = [];
  @observable accessor pasteOffsetIndex: number = 0;
  /** Set after duplicate; cleared when the link-origin modal is dismissed. */
  @observable accessor latestPasteContext: PasteContext | null = null;
  /**
   * Set when the user initiates a copy (Cmd+C / Copy button) and some of the
   * copied tasks lack a lineage annotation. The clipboard write is deferred
   * until executeCopy() is called so the user can opt into tracking before
   * the copy lands on the clipboard.
   */
  @observable accessor pendingCopyContext: CopyContext | null = null;

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
    this.pasteOffsetIndex = 0;

    // Show the CopyLineageModal for any task that has not yet made an explicit
    // tracking choice. Absence of exclude_from_reconcile = "never chose";
    // presence (true or false) = already decided, no modal needed.
    const unlinkedNodeIds = selectedNodes
      .filter((node) => {
        const task = spec.tasks.find((t) => t.$id === node.id);
        return task && !task.annotations.has(LINEAGE_EXCLUDE_ANNOTATION);
      })
      .map((n) => n.id);

    if (unlinkedNodeIds.length > 0) {
      this.pendingCopyContext = { nodeIds: unlinkedNodeIds };
      // Clipboard write is deferred — executeCopy() will do it.
    } else {
      this.pendingCopyContext = null;
      writeToSystemClipboard(snapshots, bindings);
    }
  }

  /**
   * Complete a deferred copy. Called by CopyLineageModal when the user clicks
   * "Copy".
   *
   * Regardless of `track`, the origin annotation is ALWAYS stamped on the source
   * tasks so we know where they came from and don't ask again. When `track` is
   * false the `exclude_from_reconcile` flag is also set to `"true"` so the task
   * opts out of reconcile offers while keeping its lineage history. The snapshots
   * are refreshed to carry the new annotations into the clipboard.
   */
  @action executeCopy(track: boolean, spec: ComponentSpec) {
    const ctx = this.pendingCopyContext;

    if (ctx) {
      this.undoStore.withGroup("Link task lineage", () => {
        for (const nodeId of ctx.nodeIds) {
          const task = spec.tasks.find((t) => t.$id === nodeId);
          if (!task) continue;

          // Stamp the origin (permanent — written even when not tracking).
          task.annotations.set(LINEAGE_ORIGIN_ANNOTATION, {
            originId:
              task.componentRef.url ??
              task.componentRef.digest ??
              crypto.randomUUID(),
            originDigest: task.componentRef.digest,
            originName: task.componentRef.name,
          });

          // Record the explicit choice so we don't ask again.
          // "false" = opted in; "true" = opted out.
          task.annotations.set(
            LINEAGE_EXCLUDE_ANNOTATION,
            track ? "false" : "true",
          );
        }
      });

      // Re-take snapshots so the clipboard data reflects the new lineage.
      // Note: exclude_from_reconcile is stripped from snapshots in snapshotTask
      // so copies start fresh without inheriting the source's opt-out.
      const updated = this.snapshots.map((snapshot) => {
        if (!ctx.nodeIds.includes(snapshot.entityId)) return snapshot;
        const manifest = editorRegistry.get(snapshot.$type);
        return (
          manifest?.snapshotHandler?.snapshot(spec, snapshot.entityId) ??
          snapshot
        );
      });
      this.snapshots = updated;
      void writeToSystemClipboard(updated, this.bindingSnapshots);
    } else {
      void writeToSystemClipboard(this.snapshots, this.bindingSnapshots);
    }

    this.pendingCopyContext = null;
  }

  async paste(
    spec: ComponentSpec,
    centerPosition: XYPosition,
  ): Promise<string[]> {
    const systemData = await readFromSystemClipboard();
    const snapshots = systemData?.snapshots ?? this.snapshots;
    const bindings = systemData?.bindings ?? this.bindingSnapshots;

    if (snapshots.length === 0) return [];

    const offset = this.pasteOffsetIndex * PASTE_OFFSET;
    const offsetCenter = {
      x: centerPosition.x + offset,
      y: centerPosition.y + offset,
    };
    runInAction(() => {
      this.pasteOffsetIndex += 1;
    });

    // Paste does not set latestPasteContext — the user was already given the
    // link-origin choice at copy time (CopyLineageModal). Only duplicate uses
    // latestPasteContext (it has no separate copy step).
    const { newIds } = this.cloneSnapshotsAtPosition(
      spec,
      snapshots,
      bindings,
      offsetCenter,
    );
    return newIds;
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

    const { newIds, idMap } = cloneSnapshotsWithBindings(
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
    runInAction(() => {
      this.latestPasteContext = { idMap };
    });
    return newIds;
  }

  @action clearPasteContext() {
    this.latestPasteContext = null;
  }

  @action clear() {
    this.snapshots = [];
    this.bindingSnapshots = [];
    this.pasteOffsetIndex = 0;
    this.latestPasteContext = null;
    this.pendingCopyContext = null;
  }

  private cloneSnapshotsAtPosition(
    spec: ComponentSpec,
    snapshots: NodeSnapshot[],
    bindings: BindingSnapshot[],
    centerPosition: XYPosition,
  ): CloneResult {
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
