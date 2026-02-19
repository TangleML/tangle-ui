import type { TaskSpecOutput } from "@/api/types.gen";

import {
  type ArgumentType,
  type ComponentSpec,
  isSecretArgument,
} from "../componentSpec";

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

  const argument = taskArguments?.[inputName] as ArgumentType;

  if (typeof argument === "string") {
    return argument;
  }

  if (isSecretArgument(argument)) {
    return `🔒 ${argument.dynamicData.secret.name}`;
  }

  return undefined;
}

/**
 * Returns a record of task arguments with the value as a string.
 *
 * @param taskArguments
 * @param componentSpec - Optional component specification to filter arguments by.
 * @returns
 */
export function extractTaskArguments(
  taskArguments: TaskSpecOutput["arguments"],
  componentSpec?: ComponentSpec,
): Record<string, string> {
  const componentSpecInputs = componentSpec
    ? new Set(componentSpec.inputs?.map((input) => input.name) ?? [])
    : undefined;

  return Object.fromEntries(
    Object.entries(taskArguments ?? {})
      .map(([key, _]) => [key, getArgumentValue(taskArguments, key)] as const)
      .filter(
        (entry): entry is [string, string] =>
          entry[1] !== undefined &&
          Boolean(!componentSpecInputs || componentSpecInputs.has(entry[0])),
      ),
  );
}
