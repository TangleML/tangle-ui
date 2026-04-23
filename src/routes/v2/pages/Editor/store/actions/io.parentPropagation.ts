import type { ParentContext } from "@/routes/v2/shared/store/navigationStore";

/**
 * After renaming an input inside a subgraph, update the parent spec's
 * bindings and task arguments that reference the old port name.
 */
export function propagateInputRename(
  { parentSpec, taskId }: ParentContext,
  oldName: string,
  newName: string,
): void {
  for (const binding of parentSpec.bindings) {
    if (
      binding.targetEntityId === taskId &&
      binding.targetPortName === oldName
    ) {
      binding.setTargetPortName(newName);
    }
  }

  const parentTask = parentSpec.tasks.find((t) => t.$id === taskId);
  if (!parentTask) return;

  const argIdx = parentTask.arguments.findIndex((a) => a.name === oldName);
  if (argIdx >= 0) {
    parentTask.setArgument(newName, parentTask.arguments[argIdx].value);
    parentTask.removeArgumentByName(oldName);
  }
}

/**
 * After renaming an output inside a subgraph, update the parent spec's
 * bindings that reference the old port name.
 */
export function propagateOutputRename(
  { parentSpec, taskId }: ParentContext,
  oldName: string,
  newName: string,
): void {
  for (const binding of parentSpec.bindings) {
    if (
      binding.sourceEntityId === taskId &&
      binding.sourcePortName === oldName
    ) {
      binding.setSourcePortName(newName);
    }
  }
}

/**
 * After deleting an input inside a subgraph, remove the parent spec's
 * bindings targeting that port and the corresponding task argument.
 */
export function propagateInputDelete(
  { parentSpec, taskId }: ParentContext,
  inputName: string,
): void {
  parentSpec.removeAllBindingsBy(
    (b) => b.targetEntityId === taskId && b.targetPortName === inputName,
  );

  const parentTask = parentSpec.tasks.find((t) => t.$id === taskId);
  parentTask?.removeArgumentByName(inputName);
}

/**
 * After deleting an output inside a subgraph, remove the parent spec's
 * bindings sourcing from that port.
 */
export function propagateOutputDelete(
  { parentSpec, taskId }: ParentContext,
  outputName: string,
): void {
  parentSpec.removeAllBindingsBy(
    (b) => b.sourceEntityId === taskId && b.sourcePortName === outputName,
  );
}
