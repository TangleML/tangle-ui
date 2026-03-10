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

/** Predicate types for the filter_query JSON format */
type FilterQueryPredicate =
  | { key_exists: { key: string } }
  | { value_equals: { key: string; value: string } }
  | { value_contains: { key: string; value_substring: string } }
  | { value_in: { key: string; values: string[] } }
  | { not: FilterQueryPredicate }
  | {
      time_range: {
        key: string;
        start_time?: string;
        end_time?: string;
      };
    };

interface FilterQuery {
  and: FilterQueryPredicate[];
}

/**
 * Converts PipelineRunFilters to the backend's filter_query JSON format.
 * This sends all supported filters server-side (created_by, pipeline_name,
 * date range, annotations). Status filtering remains client-side since
 * execution stats are computed separately.
 *
 * @returns JSON string for the filter_query param, or undefined if no filters apply.
 */
export function filtersToFilterQuery(
  filters: PipelineRunFilters,
): string | undefined {
  const predicates: FilterQueryPredicate[] = [];

  if (filters.created_by) {
    predicates.push({
      value_equals: {
        key: "system/pipeline_run.created_by",
        value: filters.created_by,
      },
    });
  }

  if (filters.pipeline_name) {
    predicates.push({
      value_contains: {
        key: "system/pipeline_run.name",
        value_substring: filters.pipeline_name,
      },
    });
  }

  if (filters.created_after || filters.created_before) {
    const timeRange: FilterQueryPredicate = {
      time_range: {
        key: "system/pipeline_run.date.created_at",
        ...(filters.created_after && { start_time: filters.created_after }),
        ...(filters.created_before && { end_time: filters.created_before }),
      },
    };
    predicates.push(timeRange);
  }

  if (filters.annotations) {
    for (const annotation of filters.annotations) {
      if (annotation.value) {
        predicates.push({
          value_contains: {
            key: annotation.key,
            value_substring: annotation.value,
          },
        });
      } else {
        predicates.push({ key_exists: { key: annotation.key } });
      }
    }
  }

  if (predicates.length === 0) return undefined;

  const query: FilterQuery = { and: predicates };
  return JSON.stringify(query);
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
