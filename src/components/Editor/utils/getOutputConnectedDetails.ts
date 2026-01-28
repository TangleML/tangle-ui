import { type GraphSpec, isTaskOutputArgument } from "@/utils/componentSpec";
import { getTaskDisplayName } from "@/utils/getComponentName";

/**
 * Returns the connected output value (outputName) for a given output name from a graphSpec's outputValues.
 * Returns undefined if not connected.
 */
export interface OutputConnectedDetails {
  outputName?: string;
  outputType?: string;
  taskId?: string;
  taskName?: string;
}

export function getOutputConnectedDetails(
  graphSpec: GraphSpec,
  outputName: string,
): OutputConnectedDetails {
  if (graphSpec?.outputValues) {
    const outputValue = graphSpec.outputValues[outputName];
    if (isTaskOutputArgument(outputValue)) {
      const taskId = outputValue.taskOutput.taskId;
      const taskSpec = graphSpec.tasks[taskId];
      const type =
        taskSpec?.componentRef?.spec?.outputs?.find(
          (output) => output.name === outputValue.taskOutput.outputName,
        )?.type || "Any";

      const name = getTaskDisplayName(taskId, taskSpec);

      return {
        outputName: outputValue.taskOutput.outputName,
        outputType: type as string,
        taskId: taskId,
        taskName: name,
      };
    }
  }

  return {
    outputName: undefined,
    outputType: undefined,
    taskId: undefined,
  };
}
