import type { ArgumentType, InputSpec } from "./componentSpec";
import {
  buildFileImportResult,
  emptyFileImportResult,
  type FileImportResult,
} from "./fileImportCommon";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Converts a JSON value to a string for use as an input argument.
 *
 * Strings pass through as-is. Objects, arrays, numbers, and booleans
 * are JSON.stringified so users can write raw JSON in their import files
 * instead of pre-escaping everything.
 */
function valueToString(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

/**
 * Joins multi-row JSON values, quoting plain strings that contain commas
 * so parseBulkValues doesn't split them. Values starting with { or [ are
 * already protected by brace/bracket depth tracking in the parser.
 */
function jsonValueJoiner(values: string[]): string {
  const quotedValues = values.map((v) =>
    v.includes(",") && v[0] !== "{" && v[0] !== "[" ? JSON.stringify(v) : v,
  );
  return quotedValues.join(", ");
}

/**
 * Maps JSON data onto pipeline input arguments.
 *
 * Single object: values go directly into matched inputs.
 *   { "dataset": "train.csv", "model": "rf" } → dataset=train.csv, model=rf
 *
 * Array of objects: values are joined with ", " (bulk input format).
 *   [{ "dataset": "a" }, { "dataset": "b" }] → dataset="a, b", bulk enabled
 *
 * Non-string values are JSON.stringified:
 *   { "config": { "lr": 0.01 } } → config='{"lr":0.01}'
 */
export function mapJsonToArguments(
  jsonText: string,
  inputs: InputSpec[],
  currentArgs: Record<string, ArgumentType>,
): FileImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return emptyFileImportResult();
  }

  let rows: Record<string, unknown>[];
  if (Array.isArray(parsed)) {
    if (!parsed.every(isPlainObject)) return emptyFileImportResult();
    rows = parsed;
  } else if (isPlainObject(parsed)) {
    rows = [parsed];
  } else {
    return emptyFileImportResult();
  }

  if (rows.length === 0) return emptyFileImportResult();

  // Collect all unique keys across all rows
  const allKeys = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      allKeys.add(key);
    }
  }

  const columns = new Map<string, string[]>();
  for (const key of allKeys) {
    columns.set(
      key,
      rows.map((row) => valueToString(row[key])),
    );
  }

  return buildFileImportResult(
    columns,
    rows.length,
    inputs,
    currentArgs,
    jsonValueJoiner,
  );
}
