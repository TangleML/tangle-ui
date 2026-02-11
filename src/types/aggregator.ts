/** @public */
export const AggregatorOutputType = {
  Array: "Array",
  Object: "Object",
  CSV: "CSV",
} as const;

/** @public */
export type AggregatorOutputType =
  (typeof AggregatorOutputType)[keyof typeof AggregatorOutputType];

/** @public */
export const AGGREGATOR_OUTPUT_TYPE_ANNOTATION = "aggregator.output_type";
