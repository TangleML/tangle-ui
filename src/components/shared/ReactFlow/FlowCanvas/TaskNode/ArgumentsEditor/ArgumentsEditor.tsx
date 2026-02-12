import { BlockStack } from "@/components/ui/layout";
import { Heading } from "@/components/ui/typography";
import type { ArgumentInput } from "@/types/arguments";
import type { ArgumentType, TaskSpec } from "@/utils/componentSpec";

import { ArgumentInputField } from "./ArgumentInputField";
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
        {argumentInputs.map((argument) => {
          // Aggregator inputs (agg_* and output_type) are read-only
          // - agg_* inputs are set by connections
          // - output_type is set by the dropdown selector on the node
          const isAggregatorInput = argument.key.startsWith('agg_') || argument.key === 'output_type';
          
          return (
            <ArgumentInputField
              key={argument.key}
              argument={argument}
              onSave={handleArgumentSave}
              disabled={disabled || isAggregatorInput}
            />
          );
        })}
      </BlockStack>
    </BlockStack>
  );
};
