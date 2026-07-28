import type {
  ArgumentType,
  ComponentReference,
  GraphSpec,
  InputSpec,
} from "@/utils/componentSpec";
import { deepClone } from "@/utils/deepClone";

/**
 * Replaces a task's componentRef in place (keeping the same taskId, position,
 * annotations and execution options) while preserving as much of the task's
 * existing wiring as possible.
 *
 * This is the right primitive for "Edit Component Definition": the user has
 * selected a task and edited its component, so their intent is to update that
 * specific task and keep everything they already configured.
 *
 * Unlike `replaceTaskNode` (used by "Upgrade"), this does NOT rename the task:
 * renaming would re-key the task to a new unique id derived from the component
 * name and is surprising for an in-place edit.
 *
 * Wiring is preserved with two safe exceptions, mirroring the upgrade flow:
 *  - argument bindings on this task for inputs that no longer exist in the
 *    edited component are dropped (and reported via `lostInputs`);
 *  - argument bindings on downstream tasks that consume an output this
 *    component no longer produces are dropped, to avoid dangling references.
 *
 * In the common case (editing the command/image, no input/output changes)
 * nothing is dropped and every argument and default is preserved.
 */
export const replaceTaskComponentRef = (
  taskId: string,
  newComponentRef: ComponentReference,
  graphSpec: GraphSpec,
) => {
  const updatedGraphSpec = deepClone(graphSpec);
  const task = updatedGraphSpec.tasks[taskId];

  if (!task) {
    return { updatedGraphSpec, lostInputs: [] as InputSpec[] };
  }

  const oldInputs = task.componentRef.spec?.inputs ?? [];
  const newInputNames = new Set(
    (newComponentRef.spec?.inputs ?? []).map((input) => input.name),
  );
  const newOutputNames = new Set(
    (newComponentRef.spec?.outputs ?? []).map((output) => output.name),
  );

  // Inputs present on the old component but missing from the edited one.
  const lostInputs = oldInputs.filter(
    (input) => !newInputNames.has(input.name),
  );

  task.componentRef = newComponentRef;

  // Drop this task's argument bindings for inputs that were removed.
  if (task.arguments) {
    task.arguments = Object.entries(task.arguments).reduce(
      (acc, [inputName, argument]) => {
        if (newInputNames.has(inputName)) {
          acc[inputName] = argument;
        }
        return acc;
      },
      {} as Record<string, ArgumentType>,
    );
  }

  // Drop downstream argument bindings that consume an output this component no
  // longer produces. Outputs that still exist keep working because the taskId
  // is unchanged.
  Object.values(updatedGraphSpec.tasks).forEach((downstreamTask) => {
    if (!downstreamTask.arguments) {
      return;
    }

    downstreamTask.arguments = Object.entries(downstreamTask.arguments).reduce(
      (acc, [inputName, argument]) => {
        if (
          typeof argument === "object" &&
          argument !== null &&
          "taskOutput" in argument &&
          argument.taskOutput &&
          argument.taskOutput.taskId === taskId &&
          !newOutputNames.has(argument.taskOutput.outputName)
        ) {
          return acc;
        }

        acc[inputName] = argument;
        return acc;
      },
      {} as Record<string, ArgumentType>,
    );
  });

  return { updatedGraphSpec, lostInputs } as const;
};
