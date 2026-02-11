import type { InputSpec } from "./componentSpec";

export const AGGREGATOR_INPUT_PREFIX = "input_";
export const AGGREGATOR_ADD_INPUT_HANDLE_ID = "__add_aggregator_input__";

export const getNextAggregatorInputName = (
  existingInputs: InputSpec[],
): string => {
  const aggregatorInputs = existingInputs.filter((input) =>
    input.name.startsWith(AGGREGATOR_INPUT_PREFIX),
  );

  const numbers = aggregatorInputs
    .map((input) => {
      const match = input.name.match(/^input_(\d+)$/);
      return match ? parseInt(match[1], 10) : 0;
    })
    .filter((num) => !isNaN(num));

  const maxNumber = numbers.length > 0 ? Math.max(...numbers) : 0;
  return `${AGGREGATOR_INPUT_PREFIX}${maxNumber + 1}`;
};

export const createAggregatorInput = (name: string): InputSpec => ({
  name,
  type: "String",
  optional: true,
});
