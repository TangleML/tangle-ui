import type { ArgumentType, GraphSpec } from "@/utils/componentSpec";
import { deepClone } from "@/utils/deepClone";

const replaceTaskArgumentsInGraphSpec = (
  taskId: string,
  graphSpec: GraphSpec,
  taskArguments?: Record<string, ArgumentType>,
) => {
  const cleanGraphSpec = deepClone(graphSpec);

  if (!taskArguments) {
    return graphSpec;
  }

  const newGraphSpec: GraphSpec = {
    ...cleanGraphSpec,
    tasks: {
      ...cleanGraphSpec.tasks,
      [taskId]: {
        ...cleanGraphSpec.tasks[taskId],
        arguments: taskArguments,
      },
    },
  };

  return newGraphSpec;
};

export default replaceTaskArgumentsInGraphSpec;
