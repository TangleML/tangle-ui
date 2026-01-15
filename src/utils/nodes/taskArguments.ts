import type { TaskSpecOutput } from "@/api/types.gen";

/**
 * Gets the string value of a task argument.
 *
 * @param taskArguments
 * @param inputName
 * @returns
 */
export function getArgumentValue(
  taskArguments: TaskSpecOutput["arguments"] | undefined,
  inputName: string | undefined,
) {
  if (!inputName) {
    return undefined;
  }

  const argument = taskArguments?.[inputName];
  if (typeof argument === "string") {
    return argument;
  }

  return undefined;
}
