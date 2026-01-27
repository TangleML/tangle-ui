import type {
  AnnotationFilter,
  PipelineRunFilters,
  SortDirection,
  SortField,
} from "@/types/pipelineRunFilters";
import { isValidExecutionStatus } from "@/utils/executionStatus";

const VALID_SORT_FIELDS = new Set<string>(["created_at", "pipeline_name"]);
const VALID_SORT_DIRECTIONS = new Set<string>(["asc", "desc"]);

/**
 * List of filter keys that the API currently supports.
 * Add keys here as the backend adds support for more filters.
 */
const SUPPORTED_API_FILTERS: (keyof PipelineRunFilters)[] = ["created_by"];

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
 * Converts PipelineRunFilters to the API's key:value string format.
 * Only includes filters that the API actually supports.
 *
 * @example
 * // Input: { created_by: "me", status: "FAILED", annotations: [...] }
 * // Output: "created_by:me" (status and annotations are stripped as unsupported)
 */
export function filtersToApiString(
  filters: PipelineRunFilters,
): string | undefined {
  const parts: string[] = [];

  for (const key of SUPPORTED_API_FILTERS) {
    const value = filters[key];
    if (value) {
      parts.push(`${key}:${value}`);
    }
  }

  return parts.length > 0 ? parts.join(",") : undefined;
}

/**
 * Parses the legacy key:value,key2:value2 format into a filter object.
 * Used for backwards compatibility with existing URLs.
 */
function parseApiStringToFilters(
  filterString: string | undefined,
): PipelineRunFilters {
  if (!filterString) return {};

  const filters: PipelineRunFilters = {};
  const parts = filterString.split(",");

  for (const part of parts) {
    const colonIndex = part.indexOf(":");
    if (colonIndex === -1) continue;

    const key = part.slice(0, colonIndex).trim();
    const value = part.slice(colonIndex + 1).trim();

    if (key && value) {
      // Must be kept in sync with SUPPORTED_API_FILTERS as new filters are added
      if (key === "created_by") {
        filters.created_by = value;
      }
    }
  }

  return filters;
}

/**
 * Parses the filter URL param, handling both JSON format (new) and key:value format (legacy).
 */
export function parseFilterParam(
  filterParam: string | Record<string, unknown> | undefined,
): PipelineRunFilters {
  if (!filterParam) return {};

  // Already an object (parsed by router) - validate and return
  if (isRecord(filterParam)) {
    return validateFilters(filterParam);
  }

  try {
    return validateFilters(JSON.parse(filterParam));
  } catch {
    // Invalid JSON - try legacy key:value format for backwards compatibility
    return parseApiStringToFilters(filterParam);
  }
}

/**
 * Clean and prepare PipelineRunFilters for URL serialization.
 * Returns the filter object - let TanStack Router handle JSON serialization.
 * Must include all filter keys that should persist in the URL (including annotations).
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
