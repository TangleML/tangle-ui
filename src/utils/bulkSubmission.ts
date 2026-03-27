import type { ArgumentType } from "./componentSpec";

export function parseBulkValues(raw: string): string[] {
  return raw
    .split(",")
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}

function buildBulkCountMismatchMessage(counts: Record<string, number>): string {
  const details = Object.entries(counts)
    .map(([name, count]) => `"${name}": ${count}`)
    .join(", ");
  return `Bulk inputs have different value counts: ${details}`;
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
 * Throws if counts differ.
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
    throw new Error(
      buildBulkCountMismatchMessage(
        Object.fromEntries(
          bulkEntries.map(([name, values]) => [name, values.length]),
        ),
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
