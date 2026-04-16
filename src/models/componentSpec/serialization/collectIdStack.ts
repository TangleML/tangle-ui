import type { ComponentSpec } from "../entities/componentSpec";

/**
 * Collects all entity $id values from a ComponentSpec in the exact order
 * that YamlDeserializer calls idGen.next(): inputs, outputs, tasks, bindings, spec.
 *
 * This ordering contract is critical for ReplayIdGenerator to work correctly.
 * The spec ID comes last because YamlDeserializer builds child entities first,
 * then creates the ComponentSpec with idGen.next("spec") as the final call.
 */
export function collectIdStack(spec: ComponentSpec): string[] {
  const ids: string[] = [];

  for (const input of spec.inputs) {
    ids.push(input.$id);
  }

  for (const output of spec.outputs) {
    ids.push(output.$id);
  }

  for (const task of spec.tasks) {
    ids.push(task.$id);
  }

  for (const binding of spec.bindings) {
    ids.push(binding.$id);
  }

  ids.push(spec.$id);

  return ids;
}
