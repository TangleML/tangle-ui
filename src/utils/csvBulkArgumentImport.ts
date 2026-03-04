import {
  type ArgumentType,
  type InputSpec,
  isSecretArgument,
} from "./componentSpec";

/**
 * RFC 4180 CSV parser. Handles quoted fields with commas and escaped quotes.
 *
 * "name,value\nJohn,42" → [["name","value"],["John","42"]]
 * 'a,b\n"has, comma",plain' → [["a","b"],["has, comma","plain"]]
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < text.length && text[i + 1] === '"') {
          field += '"';
          i += 2;
        } else {
          inQuotes = false;
          i++;
        }
      } else {
        field += char;
        i++;
      }
    } else {
      if (char === '"' && field.length === 0) {
        inQuotes = true;
        i++;
      } else if (char === ",") {
        row.push(field.trim());
        field = "";
        i++;
      } else if (char === "\r" && i + 1 < text.length && text[i + 1] === "\n") {
        row.push(field.trim());
        rows.push(row);
        row = [];
        field = "";
        i += 2;
      } else if (char === "\n") {
        row.push(field.trim());
        rows.push(row);
        row = [];
        field = "";
        i++;
      } else {
        field += char;
        i++;
      }
    }
  }

  // Flush last field/row
  if (field.length > 0 || row.length > 0) {
    row.push(field.trim());
    rows.push(row);
  }

  return rows;
}

/**
 * Extracts the file extension (e.g. ".csv", ".json") from a filename.
 * Returns empty string if no extension is found.
 */
export function getFileExtension(filename: string): string {
  const dotIdx = filename.lastIndexOf(".");
  return dotIdx >= 0 ? `.${filename.slice(dotIdx + 1).toLowerCase()}` : "";
}

export interface FileImportResult {
  values: Record<string, string>;
  changedInputNames: string[];
  enableBulk: boolean;
  unmatchedColumns: string[];
  skippedSecretInputs: string[];
  rowCount: number;
}

/**
 * Maps CSV data onto pipeline input arguments.
 *
 * Single data row: values go directly into matched inputs.
 * Multiple data rows: values are joined with ", " (bulk input format).
 */
export function mapCsvToArguments(
  csvText: string,
  inputs: InputSpec[],
  currentArgs: Record<string, ArgumentType>,
): FileImportResult {
  const rows = parseCsv(csvText);

  const empty: FileImportResult = {
    values: {},
    changedInputNames: [],
    enableBulk: false,
    unmatchedColumns: [],
    skippedSecretInputs: [],
    rowCount: 0,
  };

  if (rows.length === 0) return empty;

  const headers = rows[0];
  const dataRows = rows.slice(1);
  const rowCount = dataRows.length;

  if (rowCount === 0) return { ...empty, rowCount: 0 };

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

  for (let colIdx = 0; colIdx < headers.length; colIdx++) {
    const colName = headers[colIdx].trim();
    if (!colName) continue;

    if (!inputNameSet.has(colName)) {
      unmatchedColumns.push(colName);
      continue;
    }

    if (secretInputNames.has(colName)) {
      skippedSecretInputs.push(colName);
      continue;
    }

    const columnValues = dataRows.map((row) =>
      colIdx < row.length ? row[colIdx] : "",
    );

    const newValue =
      rowCount === 1 ? (columnValues[0] ?? "") : columnValues.join(", ");

    values[colName] = newValue;

    if (currentArgs[colName] !== newValue) {
      changedInputNames.push(colName);
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
