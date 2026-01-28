import {
  type ArgumentType,
  type GraphSpec,
  isGraphInputArgument,
  isTaskOutputArgument,
} from "@/utils/componentSpec";
import { getTaskDisplayName } from "@/utils/getComponentName";
import { getValue } from "@/utils/string";

/**
 * Formats display values for TaskNode input handles.
 * Shows connected nodes as "→ ComponentName.outputName" and regular values as formatted strings.
 */
export const getDisplayValue = (
  value: string | ArgumentType | undefined,
  graphSpec?: GraphSpec,
) => {
  if (isTaskOutputArgument(value)) {
    const taskOutput = value.taskOutput;
    const taskId = taskOutput?.taskId;
    const outputName = taskOutput?.outputName;

    if (taskId && graphSpec?.tasks?.[taskId]) {
      const taskSpec = graphSpec.tasks[taskId];
      const componentName = getTaskDisplayName(taskId, taskSpec);
      return `→ ${componentName}${outputName ? `.${outputName}` : ""}`;
    }

    return `→ ${taskId}${outputName ? `.${outputName}` : ""}`;
  }

  if (isGraphInputArgument(value)) {
    const inputName = value.graphInput?.inputName;

    return `→ ${inputName}`;
  }

  // For non-connected values, use the original logic
  return getValue(value);
};
