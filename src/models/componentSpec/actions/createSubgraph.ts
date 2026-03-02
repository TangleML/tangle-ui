import { Binding } from "../entities/binding";
import { ComponentSpec } from "../entities/componentSpec";
import { Input } from "../entities/input";
import { Output } from "../entities/output";
import { Task } from "../entities/task";
import type { IdGenerator } from "../factories/idGenerator";
import { JsonSerializer } from "../serialization/jsonSerializer";

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

export function createSubgraph({
  spec,
  selectedTaskIds,
  subgraphName,
  idGen,
}: CreateSubgraphParams): CreateSubgraphResult | null {
  const selectedTaskIdSet = new Set(selectedTaskIds);

  // Collect selected tasks from the spec
  const selectedTasks = spec.tasks.filter((t) => selectedTaskIdSet.has(t.$id));

  if (selectedTasks.length === 0) {
    return null;
  }

  // Analyze bindings to find boundary connections
  const allBindings = spec.bindings.all;

  // Incoming: bindings targeting selected tasks from outside the selection
  const incomingBindings = allBindings.filter(
    (b) =>
      selectedTaskIdSet.has(b.targetEntityId) &&
      !selectedTaskIdSet.has(b.sourceEntityId),
  );

  // Outgoing: bindings from selected tasks to outside the selection
  const outgoingBindings = allBindings.filter(
    (b) =>
      selectedTaskIdSet.has(b.sourceEntityId) &&
      !selectedTaskIdSet.has(b.targetEntityId),
  );

  // Internal: bindings between selected tasks
  const internalBindings = allBindings.filter(
    (b) =>
      selectedTaskIdSet.has(b.sourceEntityId) &&
      selectedTaskIdSet.has(b.targetEntityId),
  );

  // Create the subgraph ComponentSpec
  const subgraphSpec = new ComponentSpec(idGen.next("spec"), subgraphName);

  // Group incoming bindings by source - each unique source becomes one subgraph input
  const incomingBySource = groupBy(
    incomingBindings,
    (b) => `${b.sourceEntityId}:${b.sourcePortName}`,
  );

  // Create subgraph inputs and track mapping
  // Use targetPortName as the input name (preserves the argument name used by tasks)
  const inputGroups: Array<{ input: Input; bindings: Binding[] }> = [];
  for (const [, bindings] of Object.entries(incomingBySource)) {
    const first = bindings[0];
    const inputName = first.targetPortName;
    const input = new Input(idGen.next("input"), { name: inputName });
    subgraphSpec.inputs.add(input);
    inputGroups.push({ input, bindings });
  }

  // Group outgoing bindings by source - each unique source becomes one subgraph output
  const outgoingBySource = groupBy(
    outgoingBindings,
    (b) => `${b.sourceEntityId}:${b.sourcePortName}`,
  );

  // Create subgraph outputs and track mapping
  const outputGroups: Array<{ output: Output; bindings: Binding[] }> = [];
  for (const [, bindings] of Object.entries(outgoingBySource)) {
    const first = bindings[0];
    const outputName = first.sourcePortName;
    const output = new Output(idGen.next("output"), { name: outputName });
    subgraphSpec.outputs.add(output);
    outputGroups.push({ output, bindings });
  }

  // Remove boundary bindings from parent spec
  for (const binding of incomingBindings) {
    spec.bindings.removeBy((b) => b.$id === binding.$id);
  }
  for (const binding of outgoingBindings) {
    spec.bindings.removeBy((b) => b.$id === binding.$id);
  }

  // Move internal bindings from parent to subgraph
  for (const binding of internalBindings) {
    spec.bindings.removeBy((b) => b.$id === binding.$id);
    subgraphSpec.bindings.add(binding);
  }

  // Move selected tasks from parent to subgraph
  for (const task of selectedTasks) {
    spec.tasks.removeBy((t) => t.$id === task.$id);
    subgraphSpec.tasks.add(task);
  }

  // Create bindings from subgraph inputs to the moved tasks
  for (const { input, bindings } of inputGroups) {
    for (const binding of bindings) {
      const newBinding = new Binding(idGen.next("binding"), {
        source: { entityId: input.$id, portName: input.name },
        target: {
          entityId: binding.targetEntityId,
          portName: binding.targetPortName,
        },
      });
      subgraphSpec.bindings.add(newBinding);
    }
  }

  // Create bindings from moved tasks to subgraph outputs
  for (const { output, bindings } of outputGroups) {
    const first = bindings[0];
    const newBinding = new Binding(idGen.next("binding"), {
      source: {
        entityId: first.sourceEntityId,
        portName: first.sourcePortName,
      },
      target: { entityId: output.$id, portName: output.name },
    });
    subgraphSpec.bindings.add(newBinding);
  }

  // Serialize subgraph spec to JSON for the componentRef
  const serializer = new JsonSerializer();
  const subgraphSpecJson = serializer.serialize(subgraphSpec);

  // Create the replacement task in parent spec
  const replacementTask = new Task(idGen.next("task"), {
    name: subgraphName,
    componentRef: { name: subgraphName, spec: subgraphSpecJson },
  });
  spec.tasks.add(replacementTask);

  // Create bindings from external sources to replacement task inputs
  for (const { input, bindings } of inputGroups) {
    const first = bindings[0];
    replacementTask.arguments.add({ name: input.name });
    const newBinding = new Binding(idGen.next("binding"), {
      source: {
        entityId: first.sourceEntityId,
        portName: first.sourcePortName,
      },
      target: { entityId: replacementTask.$id, portName: input.name },
    });
    spec.bindings.add(newBinding);
  }

  // Create bindings from replacement task outputs to external targets
  for (const { output, bindings } of outputGroups) {
    for (const binding of bindings) {
      const newBinding = new Binding(idGen.next("binding"), {
        source: { entityId: replacementTask.$id, portName: output.name },
        target: {
          entityId: binding.targetEntityId,
          portName: binding.targetPortName,
        },
      });
      spec.bindings.add(newBinding);
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
