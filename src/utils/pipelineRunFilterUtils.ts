import { PipelineRunFiltersSchema } from "@/schemas/pipelineRunFilters";
import type { PipelineRunFilters } from "@/types/pipelineRunFilters";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Validates and extracts filter fields from an unknown object.
 * Uses Zod schema for parsing; invalid fields are silently stripped.
 */
export function validateFilters(parsed: unknown): PipelineRunFilters {
  const result = PipelineRunFiltersSchema.safeParse(parsed);
  if (result.success) return result.data;

  // Graceful fallback: try to salvage individual valid fields
  if (!isRecord(parsed)) return {};
  const partial = PipelineRunFiltersSchema.partial().safeParse(parsed);
  return partial.success ? partial.data : {};
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

/** Keys that receive special counting logic and are excluded from the generic scalar count. */
const SPECIAL_FILTER_KEYS = new Set([
  "annotations",
  "created_after",
  "created_before",
]);

/**
 * Count the number of active filters.
 * Derives from {@link serializeFiltersToUrl} so new scalar filter fields
 * are automatically counted without needing an update here.
 */
export function countActiveFilters(filters: PipelineRunFilters): number {
  const active = serializeFiltersToUrl(filters);
  if (!active) return 0;

  let count = 0;

  if (active.annotations) {
    count += active.annotations.length;
  }

  if (active.created_after || active.created_before) {
    count++;
  }

  for (const key of Object.keys(active)) {
    if (!SPECIAL_FILTER_KEYS.has(key)) {
      count++;
    }
  }

  return count;
}
