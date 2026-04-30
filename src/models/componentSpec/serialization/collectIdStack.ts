import type { ComponentSpec } from "../entities/componentSpec";

/**
 * Collects all entity $id values from a ComponentSpec in the exact order
 * that YamlDeserializer calls idGen.next():
 *   inputs, outputs, (for each task: subgraph IDs recursively, then task $id), bindings, spec.
 *
 * This ordering contract is critical for ReplayIdGenerator to work correctly.
 * The spec ID comes last because YamlDeserializer builds child entities first,
 * then creates the ComponentSpec with idGen.next("spec") as the final call.
 *
 * For tasks with subgraphs, YamlDeserializer.buildTasks calls
 * maybeDeserializeSubgraph (which recursively deserializes the subgraph)
 * BEFORE generating the parent task's $id.
 */
export function collectIdStack(spec: ComponentSpec): string[] {
  const ids: string[] = [];
  collectIds(spec, ids);
  return ids;
}

function collectIds(spec: ComponentSpec, ids: string[]): void {
  for (const input of spec.inputs) {
    ids.push(input.$id);
  }

  for (const output of spec.outputs) {
    ids.push(output.$id);
  }

  for (const task of spec.tasks) {
    if (task.subgraphSpec) {
      collectIds(task.subgraphSpec, ids);
    }
    ids.push(task.$id);
  }

  for (const binding of spec.bindings) {
    ids.push(binding.$id);
  }

  ids.push(spec.$id);
}
