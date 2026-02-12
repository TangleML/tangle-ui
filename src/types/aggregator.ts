export const AggregatorOutputType = {
  Array: "Array",
  Object: "Object",
  CSV: "CSV",
} as const;

export type AggregatorOutputType =
  (typeof AggregatorOutputType)[keyof typeof AggregatorOutputType];

export const AGGREGATOR_OUTPUT_TYPE_ANNOTATION = "aggregator.output_type";
