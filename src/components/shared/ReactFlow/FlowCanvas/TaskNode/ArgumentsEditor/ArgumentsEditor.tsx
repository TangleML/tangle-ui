import { useMemo } from "react";

import { BlockStack } from "@/components/ui/layout";
import { Heading } from "@/components/ui/typography";
import type { ArgumentInput } from "@/types/arguments";
import type { ArgumentType, TaskSpec } from "@/utils/componentSpec";

import { ArgumentInputField } from "./ArgumentInputField";
import type { TaskAnnotations } from "./dynamicDataUtils";
import { getArgumentInputs } from "./utils";

interface ArgumentsEditorProps {
  taskSpec: TaskSpec;
  setArguments: (args: Record<string, ArgumentType>) => void;
  disabled?: boolean;
}

export const ArgumentsEditor = ({
  taskSpec,
  setArguments,
  disabled = false,
}: ArgumentsEditorProps) => {
  const argumentInputs = getArgumentInputs(taskSpec);
  const taskAnnotations = useMemo(
    () => taskSpec.annotations as TaskAnnotations | undefined,
    [taskSpec.annotations],
  );

  const handleArgumentSave = (argument: ArgumentInput) => {
    const argumentValues = {
      ...Object.fromEntries(
        argumentInputs
          .filter(({ isRemoved }) => !isRemoved)
          .map(({ key, value }) => [key, value]),
      ),
    };

    if (argument.isRemoved) {
      delete argumentValues[argument.key];
    } else {
      argumentValues[argument.key] = argument.value;
    }

    setArguments(argumentValues);
  };

  return (
    <BlockStack>
      <Heading level={1}>Inputs</Heading>
      <BlockStack gap="2" className="h-auto max-h-[60vh] overflow-y-auto pb-2">
        {argumentInputs.map((argument) => (
          <ArgumentInputField
            key={argument.key}
            argument={argument}
            onSave={handleArgumentSave}
            disabled={disabled}
            taskAnnotations={taskAnnotations}
          />
        ))}
      </BlockStack>
    </BlockStack>
  );
};
