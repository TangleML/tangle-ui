import { Annotations } from "../annotations";
import { Binding } from "../entities/binding";
import { ComponentSpec } from "../entities/componentSpec";
import { Input } from "../entities/input";
import { Output } from "../entities/output";
import { Task } from "../entities/task";
import type {
  Annotation,
  Argument,
  ComponentReference,
  PredicateType,
} from "../entities/types";
import type { IdGenerator } from "../factories/idGenerator";
import { serializeComponentSpec } from "../serialization/serialize";

interface CreateSubgraphParams {
  spec: ComponentSpec;
  selectedTaskIds: string[];
  subgraphName: string;
  idGen: IdGenerator;
}

interface CreateSubgraphResult {
  subgraphSpec: ComponentSpec;
  replacementTask: Task;
}

const deepClone = <T>(obj: T): T => JSON.parse(JSON.stringify(obj));

interface TaskSnapshot {
  $id: string;
  name: string;
  componentRef: ComponentReference;
  isEnabled?: PredicateType;
  annotations: Annotation[];
  arguments: Argument[];
}

interface BindingSnapshot {
  $id: string;
  sourceEntityId: string;
  targetEntityId: string;
  sourcePortName: string;
  targetPortName: string;
}

function snapshotTask(t: Task): TaskSnapshot {
  return {
    $id: t.$id,
    name: t.name,
    componentRef: deepClone(t.componentRef),
    isEnabled: t.isEnabled ? deepClone(t.isEnabled) : undefined,
    annotations: t.annotations.items.map((a) => deepClone(a)),
    arguments: t.arguments.map((a) => deepClone(a)),
  };
}

function snapshotBinding(b: Binding): BindingSnapshot {
  return {
    $id: b.$id,
    sourceEntityId: b.sourceEntityId,
    targetEntityId: b.targetEntityId,
    sourcePortName: b.sourcePortName,
    targetPortName: b.targetPortName,
  };
}

export function createSubgraph({
  spec,
  selectedTaskIds,
  subgraphName,
  idGen,
}: CreateSubgraphParams): CreateSubgraphResult | null {
  const selectedTaskIdSet = new Set(selectedTaskIds);
  const selectedTasks = spec.tasks.filter((t) => selectedTaskIdSet.has(t.$id));

  if (selectedTasks.length === 0) {
    return null;
  }

  const allBindings = spec.bindings.map(snapshotBinding);
  const taskSnapshots = selectedTasks.map(snapshotTask);

  const incomingBindings = allBindings.filter(
    (b) =>
      selectedTaskIdSet.has(b.targetEntityId) &&
      !selectedTaskIdSet.has(b.sourceEntityId),
  );

  const outgoingBindings = allBindings.filter(
    (b) =>
      selectedTaskIdSet.has(b.sourceEntityId) &&
      !selectedTaskIdSet.has(b.targetEntityId),
  );

  const internalBindings = allBindings.filter(
    (b) =>
      selectedTaskIdSet.has(b.sourceEntityId) &&
      selectedTaskIdSet.has(b.targetEntityId),
  );

  const affectedBindingIds = new Set(
    [...incomingBindings, ...outgoingBindings, ...internalBindings].map(
      (b) => b.$id,
    ),
  );

  // Remove affected bindings and tasks from parent spec BEFORE creating subgraph
  for (const bindingId of affectedBindingIds) {
    spec.removeBindingBy((b) => b.$id === bindingId);
  }
  for (const task of selectedTasks) {
    spec.removeTaskBy((t) => t.$id === task.$id);
  }

  // Now build subgraph entities from snapshots (original models are detached)
  const incomingBySource = groupBy(
    incomingBindings,
    (b) => `${b.sourceEntityId}:${b.sourcePortName}`,
  );

  const subgraphInputs: Input[] = [];
  const inputGroups: Array<{ input: Input; bindings: BindingSnapshot[] }> = [];
  for (const [, bindings] of Object.entries(incomingBySource)) {
    const first = bindings[0];
    const inputName = first.targetPortName;
    const input = new Input({
      $id: idGen.next("input"),
      name: inputName,
    });
    subgraphInputs.push(input);
    inputGroups.push({ input, bindings });
  }

  const outgoingBySource = groupBy(
    outgoingBindings,
    (b) => `${b.sourceEntityId}:${b.sourcePortName}`,
  );

  const subgraphOutputs: Output[] = [];
  const outputGroups: Array<{ output: Output; bindings: BindingSnapshot[] }> =
    [];
  for (const [, bindings] of Object.entries(outgoingBySource)) {
    const first = bindings[0];
    const outputName = first.sourcePortName;
    const output = new Output({
      $id: idGen.next("output"),
      name: outputName,
    });
    subgraphOutputs.push(output);
    outputGroups.push({ output, bindings });
  }

  const subgraphInternalBindings: Binding[] = internalBindings.map(
    (b) =>
      new Binding({
        $id: idGen.next("binding"),
        sourceEntityId: b.sourceEntityId,
        targetEntityId: b.targetEntityId,
        sourcePortName: b.sourcePortName,
        targetPortName: b.targetPortName,
      }),
  );

  const subgraphTasks: Task[] = taskSnapshots.map(
    (t) =>
      new Task({
        $id: t.$id,
        name: t.name,
        componentRef: t.componentRef,
        isEnabled: t.isEnabled,
        annotations: Annotations.from(t.annotations),
        arguments: t.arguments,
      }),
  );

  const subgraphInputBindings: Binding[] = [];
  for (const { input, bindings } of inputGroups) {
    for (const binding of bindings) {
      subgraphInputBindings.push(
        new Binding({
          $id: idGen.next("binding"),
          sourceEntityId: input.$id,
          sourcePortName: input.name,
          targetEntityId: binding.targetEntityId,
          targetPortName: binding.targetPortName,
        }),
      );
    }
  }

  const subgraphOutputBindings: Binding[] = [];
  for (const { output, bindings } of outputGroups) {
    const first = bindings[0];
    subgraphOutputBindings.push(
      new Binding({
        $id: idGen.next("binding"),
        sourceEntityId: first.sourceEntityId,
        sourcePortName: first.sourcePortName,
        targetEntityId: output.$id,
        targetPortName: output.name,
      }),
    );
  }

  const subgraphSpec = new ComponentSpec({
    $id: idGen.next("spec"),
    name: subgraphName,
    inputs: subgraphInputs,
    outputs: subgraphOutputs,
    tasks: subgraphTasks,
    bindings: [
      ...subgraphInternalBindings,
      ...subgraphInputBindings,
      ...subgraphOutputBindings,
    ],
  });

  const subgraphSpecJson = deepClone(serializeComponentSpec(subgraphSpec));

  const replacementTaskArgs: Argument[] = inputGroups.map(({ input }) => ({
    name: input.name,
  }));

  const replacementTask = new Task({
    $id: idGen.next("task"),
    name: subgraphName,
    componentRef: { name: subgraphName, spec: subgraphSpecJson },
    arguments: replacementTaskArgs,
  });

  spec.addTask(replacementTask);

  for (const { input, bindings } of inputGroups) {
    const first = bindings[0];
    spec.addBinding(
      new Binding({
        $id: idGen.next("binding"),
        sourceEntityId: first.sourceEntityId,
        sourcePortName: first.sourcePortName,
        targetEntityId: replacementTask.$id,
        targetPortName: input.name,
      }),
    );
  }

  for (const { output, bindings } of outputGroups) {
    for (const binding of bindings) {
      spec.addBinding(
        new Binding({
          $id: idGen.next("binding"),
          sourceEntityId: replacementTask.$id,
          sourcePortName: output.name,
          targetEntityId: binding.targetEntityId,
          targetPortName: binding.targetPortName,
        }),
      );
    }
  }

  return { subgraphSpec, replacementTask };
}

function groupBy<T>(
  items: T[],
  keyFn: (item: T) => string,
): Record<string, T[]> {
  const result: Record<string, T[]> = {};
  for (const item of items) {
    const key = keyFn(item);
    if (!result[key]) {
      result[key] = [];
    }
    result[key].push(item);
  }
  return result;
}
