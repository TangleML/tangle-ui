import type { XYPosition } from "@xyflow/react";

import { Binding } from "@/models/componentSpec/entities/binding";
import { ComponentSpec } from "@/models/componentSpec/entities/componentSpec";
import type {
  Annotation,
  Argument,
  ComponentReference,
  PredicateType,
  TypeSpecType,
} from "@/models/componentSpec/entities/types";
import type { IdGenerator } from "@/models/componentSpec/factories/idGenerator";

// -- Snapshot types --

interface TaskSnapshotData {
  componentRef: ComponentReference;
  isEnabled?: PredicateType;
  arguments: Argument[];
  annotations: Annotation[];
}

interface InputSnapshotData {
  type?: TypeSpecType;
  description?: string;
  defaultValue?: string;
  optional?: boolean;
  annotations: Annotation[];
}

interface OutputSnapshotData {
  type?: TypeSpecType;
  description?: string;
  annotations: Annotation[];
}

interface BaseNodeSnapshot {
  entityId: string;
  name: string;
  position: XYPosition;
}

export interface TaskNodeSnapshot extends BaseNodeSnapshot {
  type: "task";
  data: TaskSnapshotData;
}

export interface InputNodeSnapshot extends BaseNodeSnapshot {
  type: "input";
  data: InputSnapshotData;
}

export interface OutputNodeSnapshot extends BaseNodeSnapshot {
  type: "output";
  data: OutputSnapshotData;
}

export type NodeSnapshot =
  | TaskNodeSnapshot
  | InputNodeSnapshot
  | OutputNodeSnapshot;

export interface BindingSnapshot {
  sourceEntityId: string;
  targetEntityId: string;
  sourcePortName: string;
  targetPortName: string;
}

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
