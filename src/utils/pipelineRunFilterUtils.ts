import type { PipelineRunFilters } from "@/types/pipelineRunFilters";
import { isValidExecutionStatus } from "@/utils/executionStatus";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Validates and extracts filter fields from an unknown object.
 * Used for both parsed JSON and router-provided objects.
 */
export function validateFilters(parsed: unknown): PipelineRunFilters {
  if (!isRecord(parsed)) return {};

  const filters: PipelineRunFilters = {};

  if (
    typeof parsed.status === "string" &&
    isValidExecutionStatus(parsed.status)
  ) {
    filters.status = parsed.status;
  }
  if (typeof parsed.created_by === "string") {
    filters.created_by = parsed.created_by;
  }
  if (typeof parsed.created_after === "string") {
    filters.created_after = parsed.created_after;
  }
  if (typeof parsed.created_before === "string") {
    filters.created_before = parsed.created_before;
  }
  if (typeof parsed.pipeline_name === "string") {
    filters.pipeline_name = parsed.pipeline_name;
  }

  return filters;
}

/**
 * Strips empty values from filters for clean URL serialization.
 * Returns undefined when no filters are active to keep the URL clean.
 */
export function serializeFiltersToUrl(
  filters: PipelineRunFilters,
): PipelineRunFilters | undefined {
  const result = Object.fromEntries(
    Object.entries(filters).filter(([, v]) => {
      if (v === undefined || v === null || v === "") return false;
      if (Array.isArray(v) && v.length === 0) return false;
      return true;
    }),
  );

  return Object.keys(result).length > 0
    ? (result as PipelineRunFilters)
    : undefined;
}

/**
 * Count the number of active filters.
 */
export function countActiveFilters(filters: PipelineRunFilters): number {
  let count = 0;

  if (filters.status) count++;
  if (filters.created_by) count++;
  if (filters.created_after || filters.created_before) count++;
  if (filters.pipeline_name) count++;

  return count;
}
