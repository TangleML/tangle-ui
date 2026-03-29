import type { XYPosition } from "@xyflow/react";

import type { ComponentSpec } from "@/models/componentSpec";
import type { IncrementingIdGenerator } from "@/models/componentSpec/factories/idGenerator";
import { editorRegistry } from "@/routes/v2/pages/Editor/nodes";
import { cloneBindings } from "@/routes/v2/shared/clipboard/snapshotBindings";
import type {
  BindingSnapshot,
  NodeSnapshot,
  UndoGroupable,
} from "@/routes/v2/shared/nodes/types";

export function cloneSnapshotsWithBindings(
  spec: ComponentSpec,
  snapshots: NodeSnapshot[],
  bindings: BindingSnapshot[],
  getPosition: (snapshot: NodeSnapshot) => XYPosition,
  undoStore: UndoGroupable,
  idGen: IncrementingIdGenerator,
  label: string,
): string[] {
  const newIds: string[] = [];
  const idMap = new Map<string, string>();

  undoStore.withGroup(label, () => {
    for (const snapshot of snapshots) {
      const manifest = editorRegistry.get(snapshot.$type);
      const newId = manifest?.cloneHandler?.clone(
        spec,
        snapshot,
        idGen,
        getPosition(snapshot),
        undoStore,
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
