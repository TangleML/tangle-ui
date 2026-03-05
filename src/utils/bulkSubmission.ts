import type { ArgumentType } from "./componentSpec";

/**
 * Splits a comma-separated bulk value string into individual values.
 *
 * Structure-aware: commas inside `{…}`, `[…]`, or `"…"` are not treated
 * as separators, so JSON-stringified objects survive the round-trip.
 */
export function parseBulkValues(raw: string): string[] {
  const values: string[] = [];
  let current = "";
  let braceDepth = 0;
  let bracketDepth = 0;
  let inQuote = false;

  for (let i = 0; i < raw.length; i++) {
    const char = raw[i];

    if (inQuote) {
      current += char;
      if (char === "\\" && i + 1 < raw.length) {
        current += raw[++i];
      } else if (char === '"') {
        inQuote = false;
      }
      continue;
    }

    if (char === '"') {
      inQuote = true;
      current += char;
      continue;
    }

    if (char === "{") {
      braceDepth++;
      current += char;
      continue;
    }

    if (char === "}") {
      braceDepth = Math.max(0, braceDepth - 1);
      current += char;
      continue;
    }

    if (char === "[") {
      bracketDepth++;
      current += char;
      continue;
    }

    if (char === "]") {
      bracketDepth = Math.max(0, bracketDepth - 1);
      current += char;
      continue;
    }

    if (char === "," && braceDepth === 0 && bracketDepth === 0) {
      const trimmed = current.trim();
      if (trimmed.length > 0) {
        values.push(unquote(trimmed));
      }
      current = "";
      continue;
    }

    current += char;
  }

  const trimmed = current.trim();
  if (trimmed.length > 0) {
    values.push(unquote(trimmed));
  }

  return values;
}

/**
 * If a value is wrapped in double quotes (e.g. from JSON import quoting
 * values that contain commas), strip the quotes and unescape.
 */
function unquote(value: string): string {
  if (
    value.length >= 2 &&
    value[0] === '"' &&
    value[value.length - 1] === '"'
  ) {
    try {
      const parsed = JSON.parse(value);
      if (typeof parsed === "string") return parsed;
    } catch {
      // Not valid JSON-quoted string, return as-is
    }
  }
  return value;
}

export class BulkCountMismatchError extends Error {
  constructor(public counts: Record<string, number>) {
    const details = Object.entries(counts)
      .map(([name, count]) => `"${name}": ${count}`)
      .join(", ");
    super(`Bulk inputs have different value counts: ${details}`);
    this.name = "BulkCountMismatchError";
  }
}

function parseBulkInputs(
  taskArguments: Record<string, ArgumentType>,
  bulkInputNames: Set<string>,
): Record<string, string[]> {
  const parsed: Record<string, string[]> = {};
  for (const name of bulkInputNames) {
    const raw = taskArguments[name];
    if (typeof raw === "string") {
      parsed[name] = parseBulkValues(raw);
    }
  }
  return parsed;
}

/**
 * Expands bulk inputs into N argument sets.
 *
 * { dataset: "train, test", model: "rf" } with dataset as bulk
 * → [{ dataset: "train", model: "rf" }, { dataset: "test", model: "rf" }]
 *
 * All bulk inputs must have equal value counts.
 * Throws BulkCountMismatchError if counts differ.
 */
export function expandBulkArguments(
  taskArguments: Record<string, ArgumentType>,
  bulkInputNames: Set<string>,
): Record<string, ArgumentType>[] {
  if (bulkInputNames.size === 0) return [taskArguments];

  const parsedValues = parseBulkInputs(taskArguments, bulkInputNames);
  const bulkEntries = Object.entries(parsedValues);
  if (bulkEntries.length === 0) return [taskArguments];

  const valueCounts = bulkEntries.map(([, values]) => values.length);
  if (new Set(valueCounts).size > 1) {
    throw new BulkCountMismatchError(
      Object.fromEntries(
        bulkEntries.map(([name, values]) => [name, values.length]),
      ),
    );
  }

  const runCount = valueCounts[0] ?? 1;

  const result: Record<string, ArgumentType>[] = [];
  for (let i = 0; i < runCount; i++) {
    const args: Record<string, ArgumentType> = {};
    for (const [name, value] of Object.entries(taskArguments)) {
      args[name] = name in parsedValues ? parsedValues[name][i] : value;
    }
    result.push(args);
  }

  return result;
}

/**
 * Returns expected number of runs from bulk inputs.
 *
 * { a: "x, y, z" } with a as bulk → 3
 * { a: "x, y", b: "1, 2" } with both as bulk → 2
 * { a: "x, y", b: "1, 2, 3" } with both as bulk → -1 (mismatch)
 */
export function getBulkRunCount(
  taskArguments: Record<string, ArgumentType>,
  bulkInputNames: Set<string>,
): number {
  if (bulkInputNames.size === 0) return 1;

  const counts = Object.values(
    parseBulkInputs(taskArguments, bulkInputNames),
  ).map((values) => values.length);

  if (counts.length === 0) return 1;
  if (new Set(counts).size > 1) return -1;
  return counts[0];
}
