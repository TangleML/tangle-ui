import type {
  AnnotationFilter,
  PipelineRunFilters,
  SortDirection,
  SortField,
} from "@/types/pipelineRunFilters";
import { isValidExecutionStatus } from "@/utils/executionStatus";

const VALID_SORT_FIELDS = new Set<string>(["created_at", "pipeline_name"]);
const VALID_SORT_DIRECTIONS = new Set<string>(["asc", "desc"]);

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidAnnotationFilter(value: unknown): value is AnnotationFilter {
  return (
    isRecord(value) &&
    typeof value.key === "string" &&
    (value.value === undefined || typeof value.value === "string")
  );
}

function isValidSortField(value: string): value is SortField {
  return VALID_SORT_FIELDS.has(value);
}

function isValidSortDirection(value: string): value is SortDirection {
  return VALID_SORT_DIRECTIONS.has(value);
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
  if (Array.isArray(parsed.annotations)) {
    const validAnnotations = parsed.annotations.filter(isValidAnnotationFilter);
    if (validAnnotations.length > 0) {
      filters.annotations = validAnnotations;
    }
  }
  if (
    typeof parsed.sort_field === "string" &&
    isValidSortField(parsed.sort_field)
  ) {
    filters.sort_field = parsed.sort_field;
  }
  if (
    typeof parsed.sort_direction === "string" &&
    isValidSortDirection(parsed.sort_direction)
  ) {
    filters.sort_direction = parsed.sort_direction;
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

/** Keys that receive special counting logic and are excluded from the generic scalar count. */
const SPECIAL_FILTER_KEYS = new Set([
  "annotations",
  "created_after",
  "created_before",
  "sort_field",
  "sort_direction",
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
