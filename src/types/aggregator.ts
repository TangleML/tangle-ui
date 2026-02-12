/** @public */
export const AggregatorOutputType = {
  JsonArray: "JsonArray",
  JsonObject: "JsonObject",
  CSV: "CSV",
} as const;

/** @public */
export type AggregatorOutputType =
  (typeof AggregatorOutputType)[keyof typeof AggregatorOutputType];
