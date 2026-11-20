import type { ComponentSpec } from "@/models/componentSpec";
import { useArgumentActions } from "@/routes/v2/pages/Editor/components/ArgumentRow/useArgumentActions";
import type { InputConnectionActions } from "@/routes/v2/shared/nodes/TaskNode/InputConnectionActionsContext";

/**
 * Builds the Editor-side {@link InputConnectionActions} used by embedded input
 * ports on task nodes: reconnecting to a different graph input (via
 * `quickConnect`) and disconnecting (via `unsetArgument`, which drops the
 * argument and its bindings). Both are undo-grouped through `useArgumentActions`.
 */
export function useEmbeddedInputConnectionActions(
  spec: ComponentSpec | null,
): InputConnectionActions {
  const { quickConnect, unsetArgument } = useArgumentActions();

  return {
    changeInputConnection: (
      taskEntityId,
      inputName,
      sourceInputEntityId,
      sourceInputName,
    ) => {
      if (!spec) return;
      quickConnect(
        spec,
        sourceInputEntityId,
        sourceInputName,
        taskEntityId,
        inputName,
      );
    },
    disconnectInput: (taskEntityId, inputName) => {
      if (!spec) return;
      const task = spec.tasks.find((t) => t.$id === taskEntityId);
      if (!task) return;
      unsetArgument(task, spec, inputName);
    },
  };
}
