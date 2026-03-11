import { parseBulkValues } from "./bulkSubmission";
import {
  type ArgumentType,
  type InputSpec,
  isSecretArgument,
} from "./componentSpec";

/**
 * Quotes a CSV field if it contains commas, quotes, or newlines (RFC 4180).
 */
function quoteCsvField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Generates a CSV with input names as column headers.
 *
 * Bulk inputs are expanded into separate rows (one value per row).
 * Non-bulk inputs repeat their value across all rows.
 * Skips inputs that currently hold secret values.
 *
 * { experiment_key: "12345, 1, 2, 9", predictions: "1234, 4, 6, 5" }
 * with both as bulk →
 *   experiment_key,predictions
 *   12345,1234
 *   1,4
 *   2,6
 *   9,5
 */
export function generateCsvTemplate(
  inputs: InputSpec[],
  currentArgs: Record<string, ArgumentType>,
  bulkInputNames: Set<string> = new Set(),
): string {
  const nonSecretInputs = inputs.filter(
    (input) => !isSecretArgument(currentArgs[input.name]),
  );

  if (nonSecretInputs.length === 0) return "";

  const headers = nonSecretInputs.map((input) => input.name);

  const columns = nonSecretInputs.map((input) => {
    const current = currentArgs[input.name];
    const raw =
      typeof current === "string" && current.length > 0
        ? current
        : (input.default ?? "");

    if (bulkInputNames.has(input.name) && raw.length > 0) {
      return parseBulkValues(raw);
    }
    return [raw];
  });

  const rowCount = Math.max(...columns.map((col) => col.length), 1);

  const rows: string[] = [headers.join(",")];
  for (let i = 0; i < rowCount; i++) {
    const row = columns.map((col) => {
      const value = i < col.length ? col[i] : (col[0] ?? "");
      return quoteCsvField(value);
    });
    rows.push(row.join(","));
  }

  return rows.join("\n");
}
