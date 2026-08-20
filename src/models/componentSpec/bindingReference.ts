import type { Binding } from "./entities/binding";
import type { ComponentSpec } from "./entities/componentSpec";
import type { ArgumentType } from "./entities/types";

/**
 * Resolves a binding's source into the reference shape it serializes to. The
 * serializer and the editor both need this, and they have to agree: the shape
 * written to the user's file is the shape the editor reads back.
 */
export function bindingToArgumentReference(
  binding: Binding,
  spec: ComponentSpec,
): ArgumentType | undefined {
  const sourceTask = spec.tasks.find((t) => t.$id === binding.sourceEntityId);
  if (sourceTask) {
    return {
      taskOutput: {
        taskId: sourceTask.name,
        outputName: binding.sourcePortName,
      },
    };
  }

  const sourceInput = spec.inputs.find((i) => i.$id === binding.sourceEntityId);
  if (sourceInput) {
    return { graphInput: { inputName: sourceInput.name } };
  }

  return undefined;
}
