import type { InputSpec } from "./componentSpec";

export const AGGREGATOR_INPUT_PREFIX = "agg_";
export const AGGREGATOR_ADD_INPUT_HANDLE_ID = "__add_aggregator_input__";

export const getNextAggregatorInputName = (
  existingInputs: InputSpec[],
): string => {
  const aggregatorInputs = existingInputs.filter((input) =>
    input.name.startsWith(AGGREGATOR_INPUT_PREFIX),
  );

  const numbers = aggregatorInputs
    .map((input) => {
      const num = parseInt(
        input.name.slice(AGGREGATOR_INPUT_PREFIX.length),
        10,
      );
      return isNaN(num) ? 0 : num;
    })
    .filter((num) => num > 0);

  const maxNumber = numbers.length > 0 ? Math.max(...numbers) : 0;
  return `${AGGREGATOR_INPUT_PREFIX}${maxNumber + 1}`;
};

export const createAggregatorInput = (name: string): InputSpec => ({
  name,
  type: "String",
  optional: true,
});
