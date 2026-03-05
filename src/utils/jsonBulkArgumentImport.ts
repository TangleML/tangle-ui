import {
  type ArgumentType,
  type InputSpec,
  isSecretArgument,
} from "./componentSpec";

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

interface JsonImportResult {
  values: Record<string, string>;
  changedInputNames: string[];
  enableBulk: boolean;
  unmatchedColumns: string[];
  skippedSecretInputs: string[];
  rowCount: number;
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
): JsonImportResult {
  const empty: JsonImportResult = {
    values: {},
    changedInputNames: [],
    enableBulk: false,
    unmatchedColumns: [],
    skippedSecretInputs: [],
    rowCount: 0,
  };

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return empty;
  }

  let rows: Record<string, unknown>[];
  if (Array.isArray(parsed)) {
    if (!parsed.every(isPlainObject)) return empty;
    rows = parsed;
  } else if (isPlainObject(parsed)) {
    rows = [parsed];
  } else {
    return empty;
  }

  if (rows.length === 0) return empty;

  const rowCount = rows.length;

  const inputNameSet = new Set(inputs.map((i) => i.name));
  const secretInputNames = new Set(
    inputs
      .filter((i) => isSecretArgument(currentArgs[i.name]))
      .map((i) => i.name),
  );

  // Collect all unique keys across all rows
  const allKeys = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      allKeys.add(key);
    }
  }

  const unmatchedColumns: string[] = [];
  const skippedSecretInputs: string[] = [];
  const values: Record<string, string> = {};
  const changedInputNames: string[] = [];

  for (const key of allKeys) {
    if (!inputNameSet.has(key)) {
      unmatchedColumns.push(key);
      continue;
    }

    if (secretInputNames.has(key)) {
      skippedSecretInputs.push(key);
      continue;
    }

    const columnValues = rows.map((row) => valueToString(row[key]));

    let newValue: string;
    if (rowCount === 1) {
      newValue = columnValues[0] ?? "";
    } else {
      // Quote plain string values that contain commas so parseBulkValues
      // doesn't split them. Values starting with { or [ are already protected
      // by brace/bracket depth tracking in the parser.
      const quotedValues = columnValues.map((v) =>
        v.includes(",") && v[0] !== "{" && v[0] !== "[" ? JSON.stringify(v) : v,
      );
      newValue = quotedValues.join(", ");
    }

    values[key] = newValue;

    if (currentArgs[key] !== newValue) {
      changedInputNames.push(key);
    }
  }

  return {
    values,
    changedInputNames,
    enableBulk: rowCount > 1,
    unmatchedColumns,
    skippedSecretInputs,
    rowCount,
  };
}
