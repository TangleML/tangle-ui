import { Binding } from "@/models/componentSpec/entities/binding";
import { ComponentSpec } from "@/models/componentSpec/entities/componentSpec";
import type { IdGenerator } from "@/models/componentSpec/factories/idGenerator";
import type {
  BindingSnapshot,
  FlexNodeSnapshot,
  NodeSnapshot,
} from "@/routes/v2/shared/nodes/types";

export type { BindingSnapshot, FlexNodeSnapshot, NodeSnapshot };

// -- Standalone binding helpers (node-type-independent) --

export function snapshotInternalBindings(
  spec: ComponentSpec,
  selectedEntityIds: Set<string>,
): BindingSnapshot[] {
  return spec.bindings
    .filter(
      (b) =>
        selectedEntityIds.has(b.sourceEntityId) &&
        selectedEntityIds.has(b.targetEntityId),
    )
    .map((b) => ({
      sourceEntityId: b.sourceEntityId,
      targetEntityId: b.targetEntityId,
      sourcePortName: b.sourcePortName,
      targetPortName: b.targetPortName,
    }));
}

export function cloneBindings(
  spec: ComponentSpec,
  bindingSnapshots: BindingSnapshot[],
  idMap: Map<string, string>,
  idGen: IdGenerator,
) {
  for (const bs of bindingSnapshots) {
    const newSourceId = idMap.get(bs.sourceEntityId);
    const newTargetId = idMap.get(bs.targetEntityId);
    if (!newSourceId || !newTargetId) continue;

    spec.addBinding(
      new Binding({
        $id: idGen.next("binding"),
        sourceEntityId: newSourceId,
        targetEntityId: newTargetId,
        sourcePortName: bs.sourcePortName,
        targetPortName: bs.targetPortName,
      }),
    );
  }
}
