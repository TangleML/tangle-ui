import type { InputSpec } from "./componentSpec";

export const AGGREGATOR_INPUT_PREFIX = "input_";
export const AGGREGATOR_ADD_INPUT_HANDLE_ID = "__add_aggregator_input__";

export const getNextAggregatorInputName = (
  existingInputs: InputSpec[],
): string => {
  const aggregatorInputs = existingInputs.filter((input) =>
    input.name.match(/^\d+$/),
  );

  const numbers = aggregatorInputs
    .map((input) => {
      const num = parseInt(input.name, 10);
      return isNaN(num) ? 0 : num;
    })
    .filter((num) => num > 0);

  const maxNumber = numbers.length > 0 ? Math.max(...numbers) : 0;
  return `${maxNumber + 1}`;
};

export const createAggregatorInput = (name: string): InputSpec => ({
  name,
  type: "String",
  optional: true,
});
