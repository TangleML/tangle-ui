import {
  type ArgumentType,
  type InputSpec,
  isSecretArgument,
} from "./componentSpec";

export interface FileImportResult {
  values: Record<string, string>;
  changedInputNames: string[];
  enableBulk: boolean;
  unmatchedColumns: string[];
  skippedSecretInputs: string[];
  rowCount: number;
}

/**
 * Extracts the file extension (e.g. ".csv", ".json") from a filename.
 * Returns empty string if no extension is found.
 */
export function getFileExtension(filename: string): string {
  const dotIdx = filename.lastIndexOf(".");
  return dotIdx >= 0 ? `.${filename.slice(dotIdx + 1).toLowerCase()}` : "";
}

const EMPTY_RESULT: FileImportResult = {
  values: {},
  changedInputNames: [],
  enableBulk: false,
  unmatchedColumns: [],
  skippedSecretInputs: [],
  rowCount: 0,
};

export function emptyFileImportResult(): FileImportResult {
  return { ...EMPTY_RESULT };
}

/**
 * Shared logic for mapping parsed file data (CSV rows, JSON objects, etc.)
 * onto pipeline input arguments.
 *
 * @param columns Map of column/key name → array of string values (one per row)
 * @param rowCount Number of data rows
 * @param inputs Pipeline input specs
 * @param currentArgs Current argument values (to detect changes and secrets)
 * @param valueJoiner Optional custom joiner for multi-row values. Defaults to
 *   `(values) => values.join(", ")`. JSON uses this to quote values with commas.
 */
export function buildFileImportResult(
  columns: Map<string, string[]>,
  rowCount: number,
  inputs: InputSpec[],
  currentArgs: Record<string, ArgumentType>,
  valueJoiner?: (values: string[]) => string,
): FileImportResult {
  if (rowCount === 0) return emptyFileImportResult();

  const join = valueJoiner ?? ((values: string[]) => values.join(", "));

  const inputNameSet = new Set(inputs.map((i) => i.name));
  const secretInputNames = new Set(
    inputs
      .filter((i) => isSecretArgument(currentArgs[i.name]))
      .map((i) => i.name),
  );

  const unmatchedColumns: string[] = [];
  const skippedSecretInputs: string[] = [];
  const values: Record<string, string> = {};
  const changedInputNames: string[] = [];

  for (const [key, columnValues] of columns) {
    if (!key) continue;

    if (!inputNameSet.has(key)) {
      unmatchedColumns.push(key);
      continue;
    }

    if (secretInputNames.has(key)) {
      skippedSecretInputs.push(key);
      continue;
    }

    const newValue =
      rowCount === 1 ? (columnValues[0] ?? "") : join(columnValues);

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
