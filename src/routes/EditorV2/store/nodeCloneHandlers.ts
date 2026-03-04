import type { XYPosition } from "@xyflow/react";

import { Annotations } from "@/models/componentSpec/annotations";
import { Binding } from "@/models/componentSpec/entities/binding";
import { ComponentSpec } from "@/models/componentSpec/entities/componentSpec";
import { Input } from "@/models/componentSpec/entities/input";
import { Output } from "@/models/componentSpec/entities/output";
import { Task } from "@/models/componentSpec/entities/task";
import type {
  Annotation,
  Argument,
  ComponentReference,
  PredicateType,
  TypeSpecType,
} from "@/models/componentSpec/entities/types";
import type { IdGenerator } from "@/models/componentSpec/factories/idGenerator";

import type { SelectedNode } from "./editorStore";

// -- Snapshot types --

const deepClone = <T>(obj: T): T => JSON.parse(JSON.stringify(obj));

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

export interface NodeSnapshot {
  entityId: string;
  type: SelectedNode["type"];
  name: string;
  position: XYPosition;
  data: TaskSnapshotData | InputSnapshotData | OutputSnapshotData;
}

export interface BindingSnapshot {
  sourceEntityId: string;
  targetEntityId: string;
  sourcePortName: string;
  targetPortName: string;
}

// -- Handler interface --

interface NodeCloneHandler {
  readonly type: SelectedNode["type"];
  snapshot(spec: ComponentSpec, entityId: string): NodeSnapshot | null;
  clone(
    spec: ComponentSpec,
    snapshot: NodeSnapshot,
    idGen: IdGenerator,
    position: XYPosition,
  ): string | null;
}

// -- Concrete handlers --

class TaskCloneHandler implements NodeCloneHandler {
  readonly type = "task" as const;

  snapshot(spec: ComponentSpec, entityId: string): NodeSnapshot | null {
    const task = spec.tasks.find((t) => t.$id === entityId);
    if (!task) return null;

    const nonEditorAnnotations = task.annotations.items
      .filter((a) => !a.key.startsWith("editor."))
      .map((a) => deepClone(a));

    const data: TaskSnapshotData = {
      componentRef: deepClone(task.componentRef),
      isEnabled: task.isEnabled ? deepClone(task.isEnabled) : undefined,
      arguments: task.arguments.map((a) => deepClone(a)),
      annotations: nonEditorAnnotations,
    };

    return {
      entityId: task.$id,
      type: "task",
      name: task.name,
      position: task.annotations.get("editor.position"),
      data,
    };
  }

  clone(
    spec: ComponentSpec,
    snapshot: NodeSnapshot,
    idGen: IdGenerator,
    position: XYPosition,
  ): string | null {
    const data = snapshot.data as TaskSnapshotData;
    const uniqueName = generateUniqueTaskName(spec, snapshot.name);

    const annotations = Annotations.from([
      ...data.annotations,
      { key: "editor.position", value: position },
    ]);

    const task = new Task({
      $id: idGen.next("task"),
      name: uniqueName,
      componentRef: deepClone(data.componentRef),
      isEnabled: data.isEnabled ? deepClone(data.isEnabled) : undefined,
      annotations,
      arguments: deepClone(data.arguments),
    });

    spec.addTask(task);
    return task.$id;
  }
}

class InputCloneHandler implements NodeCloneHandler {
  readonly type = "input" as const;

  snapshot(spec: ComponentSpec, entityId: string): NodeSnapshot | null {
    const input = spec.inputs.find((i) => i.$id === entityId);
    if (!input) return null;

    const nonEditorAnnotations = input.annotations.items
      .filter((a) => !a.key.startsWith("editor."))
      .map((a) => deepClone(a));

    const data: InputSnapshotData = {
      type: input.type ? deepClone(input.type) : undefined,
      description: input.description,
      defaultValue: input.defaultValue,
      optional: input.optional,
      annotations: nonEditorAnnotations,
    };

    return {
      entityId: input.$id,
      type: "input",
      name: input.name,
      position: input.annotations.get("editor.position"),
      data,
    };
  }

  clone(
    spec: ComponentSpec,
    snapshot: NodeSnapshot,
    idGen: IdGenerator,
    position: XYPosition,
  ): string | null {
    const data = snapshot.data as InputSnapshotData;
    const uniqueName = generateUniqueInputName(spec, snapshot.name);

    const input = new Input({
      $id: idGen.next("input"),
      name: uniqueName,
      type: data.type ? deepClone(data.type) : undefined,
      description: data.description,
      defaultValue: data.defaultValue,
      optional: data.optional,
      annotations: Annotations.from([
        ...data.annotations,
        { key: "editor.position", value: position },
      ]),
    });

    spec.addInput(input);
    return input.$id;
  }
}

class OutputCloneHandler implements NodeCloneHandler {
  readonly type = "output" as const;

  snapshot(spec: ComponentSpec, entityId: string): NodeSnapshot | null {
    const output = spec.outputs.find((o) => o.$id === entityId);
    if (!output) return null;

    const nonEditorAnnotations = output.annotations.items
      .filter((a) => !a.key.startsWith("editor."))
      .map((a) => deepClone(a));

    const data: OutputSnapshotData = {
      type: output.type ? deepClone(output.type) : undefined,
      description: output.description,
      annotations: nonEditorAnnotations,
    };

    return {
      entityId: output.$id,
      type: "output",
      name: output.name,
      position: output.annotations.get("editor.position"),
      data,
    };
  }

  clone(
    spec: ComponentSpec,
    snapshot: NodeSnapshot,
    idGen: IdGenerator,
    position: XYPosition,
  ): string | null {
    const data = snapshot.data as OutputSnapshotData;
    const uniqueName = generateUniqueOutputName(spec, snapshot.name);

    const output = new Output({
      $id: idGen.next("output"),
      name: uniqueName,
      type: data.type ? deepClone(data.type) : undefined,
      description: data.description,
      annotations: Annotations.from([
        ...data.annotations,
        { key: "editor.position", value: position },
      ]),
    });

    spec.addOutput(output);
    return output.$id;
  }
}

// -- Registry --

class NodeCloneRegistry {
  private handlers = new Map<string, NodeCloneHandler>();

  register(handler: NodeCloneHandler) {
    this.handlers.set(handler.type, handler);
  }

  getHandler(type: SelectedNode["type"]): NodeCloneHandler | undefined {
    return this.handlers.get(type);
  }

  snapshotNode(spec: ComponentSpec, node: SelectedNode): NodeSnapshot | null {
    const handler = this.handlers.get(node.type);
    if (!handler) return null;
    return handler.snapshot(spec, node.id);
  }

  cloneNode(
    spec: ComponentSpec,
    snapshot: NodeSnapshot,
    idGen: IdGenerator,
    position: XYPosition,
  ): string | null {
    const handler = this.handlers.get(snapshot.type);
    if (!handler) return null;
    return handler.clone(spec, snapshot, idGen, position);
  }

  snapshotInternalBindings(
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

  cloneBindings(
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
}

// -- Singleton with default handlers --

export const nodeCloneRegistry = new NodeCloneRegistry();
nodeCloneRegistry.register(new TaskCloneHandler());
nodeCloneRegistry.register(new InputCloneHandler());
nodeCloneRegistry.register(new OutputCloneHandler());

// -- Re-exported name generators for use by handlers --
// These are kept in sync with the ones in actions.ts

function generateUniqueTaskName(spec: ComponentSpec, baseName: string): string {
  const existingNames = new Set(spec.tasks.map((t) => t.name));
  if (!existingNames.has(baseName)) return baseName;
  let counter = 2;
  while (existingNames.has(`${baseName} ${counter}`)) counter++;
  return `${baseName} ${counter}`;
}

function generateUniqueInputName(
  spec: ComponentSpec,
  baseName = "Input",
): string {
  const existingNames = new Set(spec.inputs.map((i) => i.name));
  if (!existingNames.has(baseName)) return baseName;
  let counter = 2;
  while (existingNames.has(`${baseName} ${counter}`)) counter++;
  return `${baseName} ${counter}`;
}

function generateUniqueOutputName(
  spec: ComponentSpec,
  baseName = "Output",
): string {
  const existingNames = new Set(spec.outputs.map((o) => o.name));
  if (!existingNames.has(baseName)) return baseName;
  let counter = 2;
  while (existingNames.has(`${baseName} ${counter}`)) counter++;
  return `${baseName} ${counter}`;
}
