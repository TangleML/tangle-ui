import type { ArgumentType } from "./componentSpec";
import { MAX_BATCH_SIZE } from "./submitPipeline";

/** A sweep defines multiple values for one or more parameters. */
export interface SweepParameter {
  name: string;
  values: string[];
}

/**
 * Generates run argument sets from sweep parameters using cartesian product.
 *
 * Every combination of all parameter values (N x M x ...).
 * Non-swept parameters are carried through unchanged.
 */
export function expandSweep(
  baseArguments: Record<string, ArgumentType>,
  sweepParams: SweepParameter[],
): Record<string, ArgumentType>[] {
  const activeParams = sweepParams.filter((p) => p.values.length > 0);
  if (activeParams.length === 0) return [baseArguments];

  return cartesianProduct(activeParams).map((combo) => ({
    ...baseArguments,
    ...combo,
  }));
}

function cartesianProduct(params: SweepParameter[]): Record<string, string>[] {
  if (params.length === 0) return [{}];

  const [first, ...rest] = params;
  const restCombinations = cartesianProduct(rest);

  const result: Record<string, string>[] = [];
  for (const value of first.values) {
    for (const combo of restCombinations) {
      result.push({ [first.name]: value, ...combo });
    }
  }
  return result;
}

/** Returns the total number of runs a sweep would produce. */
export function getSweepRunCount(sweepParams: SweepParameter[]): number {
  const activeParams = sweepParams.filter((p) => p.values.length > 0);
  if (activeParams.length === 0) return 0;
  return activeParams.reduce((total, p) => total * p.values.length, 1);
}

/** Validates sweep configuration and returns an error message if invalid. */
export function validateSweep(sweepParams: SweepParameter[]): string | null {
  const activeParams = sweepParams.filter((p) => p.values.length > 0);
  if (activeParams.length === 0) {
    return "Add at least one value to a parameter to create a sweep.";
  }

  const emptyValueParams = activeParams.filter((p) =>
    p.values.some((v) => v.trim() === ""),
  );
  if (emptyValueParams.length > 0) {
    return `Empty values found in: ${emptyValueParams.map((p) => `"${p.name}"`).join(", ")}`;
  }

  const runCount = getSweepRunCount(sweepParams);
  if (runCount > MAX_BATCH_SIZE) {
    return `Sweep produces ${runCount} runs, which exceeds the maximum of ${MAX_BATCH_SIZE}.`;
  }

  return null;
}

/**
 * Parses a range string like "0.001..0.1 log 5" into discrete values.
 *
 * Format: "start..end [scale] [steps]"
 * - scale: "linear" (default) or "log"
 * - steps: number of values to generate (default: 5)
 */
export function parseRange(rangeStr: string): string[] | null {
  const rangePattern =
    /^(-?[\d.]+)\.\.(-?[\d.]+)(?:\s+(linear|log))?(?:\s+(\d+))?$/;
  const match = rangeStr.trim().match(rangePattern);
  if (!match) return null;

  const start = Number(match[1]);
  const end = Number(match[2]);
  const scaleRaw = match[3] ?? "linear";
  if (scaleRaw !== "linear" && scaleRaw !== "log") return null;
  const scale = scaleRaw;
  const steps = Number(match[4] ?? 5);

  if (Number.isNaN(start) || Number.isNaN(end) || steps < 2) return null;

  if (scale === "log") {
    if (start <= 0 || end <= 0) return null;
    const logStart = Math.log10(start);
    const logEnd = Math.log10(end);
    return Array.from({ length: steps }, (_, i) => {
      const t = i / (steps - 1);
      const value = 10 ** (logStart + t * (logEnd - logStart));
      return formatNumber(value);
    });
  }

  return Array.from({ length: steps }, (_, i) => {
    const t = i / (steps - 1);
    const value = start + t * (end - start);
    return formatNumber(value);
  });
}

function formatNumber(n: number): string {
  // Avoid floating point artifacts like 0.30000000000000004
  const rounded = Number(n.toPrecision(10));
  return String(rounded);
}
