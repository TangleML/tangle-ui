import type { ArgumentType, InputSpec } from "./componentSpec";
import {
  buildFileImportResult,
  emptyFileImportResult,
  type FileImportResult,
} from "./fileImportCommon";

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

  if (rows.length === 0) return emptyFileImportResult();

  const headers = rows[0];
  const dataRows = rows.slice(1);

  if (dataRows.length === 0) return emptyFileImportResult();

  const columns = new Map<string, string[]>();
  for (let colIdx = 0; colIdx < headers.length; colIdx++) {
    const colName = headers[colIdx].trim();
    columns.set(
      colName,
      dataRows.map((row) => (colIdx < row.length ? row[colIdx] : "")),
    );
  }

  return buildFileImportResult(columns, dataRows.length, inputs, currentArgs);
}
