import type { ArgumentType, GraphSpec } from "@/utils/componentSpec";

export const setTaskArgument = (
  graphSpec: GraphSpec,
  taskId: string,
  inputName: string,
  argument?: ArgumentType,
) => {
  const oldTaskSpec = graphSpec.tasks[taskId];
  const oldTaskSpecArguments = oldTaskSpec.arguments || {};

  const nonNullArgumentObject = argument ? { [inputName]: argument } : {};
  const newTaskSpecArguments = {
    ...Object.fromEntries(
      Object.entries(oldTaskSpecArguments).filter(([key]) => key !== inputName),
    ),
    ...nonNullArgumentObject,
  };

  return {
    ...graphSpec,
    tasks: {
      ...graphSpec.tasks,
      [taskId]: {
        ...graphSpec.tasks[taskId],
        arguments: newTaskSpecArguments,
      },
    },
  };
};
