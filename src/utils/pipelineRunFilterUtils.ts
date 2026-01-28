import type { PipelineRunFilters } from "@/types/pipelineRunFilters";

/**
 * List of filter keys that the API currently supports.
 * Add keys here as the backend adds support for more filters.
 */
const SUPPORTED_API_FILTERS: (keyof PipelineRunFilters)[] = ["created_by"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Type guard to validate a parsed object has the expected PipelineRunFilters shape.
 * Performs runtime validation instead of unsafe type assertion.
 */
function isPipelineRunFilters(value: unknown): value is PipelineRunFilters {
  if (!isRecord(value)) return false;

  // Validate known fields have correct types if present
  if (value.status !== undefined && typeof value.status !== "string") {
    return false;
  }
  if (value.created_by !== undefined && typeof value.created_by !== "string") {
    return false;
  }
  if (
    value.created_after !== undefined &&
    typeof value.created_after !== "string"
  ) {
    return false;
  }
  if (
    value.created_before !== undefined &&
    typeof value.created_before !== "string"
  ) {
    return false;
  }
  if (
    value.pipeline_name !== undefined &&
    typeof value.pipeline_name !== "string"
  ) {
    return false;
  }
  if (value.annotations !== undefined && !Array.isArray(value.annotations)) {
    return false;
  }

  return true;
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
    if (value !== undefined && value !== null && value !== "") {
      // Handle simple string values
      if (typeof value === "string") {
        parts.push(`${key}:${value}`);
      }
      // Future: handle arrays or complex values when API supports them
    }
  }

  return parts.length > 0 ? parts.join(",") : undefined;
}

/**
 * Parses the legacy key:value,key2:value2 format into a filter object.
 * Used for backwards compatibility with existing URLs.
 */
export function parseApiStringToFilters(
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
      if (key === "created_by") {
        filters.created_by = value;
      }
      // Add more cases as API supports more filters
    }
  }

  return filters;
}

/**
 * Parses the filter URL param, handling both JSON format (new) and key:value format (legacy).
 */
export function parseFilterParam(
  filterParam: string | undefined,
): PipelineRunFilters {
  if (!filterParam) return {};

  // Try JSON format first (new format from PipelineRunFiltersBar)
  try {
    const parsed: unknown = JSON.parse(filterParam);
    if (isPipelineRunFilters(parsed)) {
      return parsed;
    }
  } catch {
    // Not JSON, fall through to legacy format
  }

  // Fall back to legacy key:value format
  return parseApiStringToFilters(filterParam);
}

/**
 * Returns the list of filter keys that are set but not supported by the API.
 * Useful for showing users which filters are UI-only.
 */
export function getUnsupportedActiveFilters(
  filters: PipelineRunFilters,
): (keyof PipelineRunFilters)[] {
  const unsupported: (keyof PipelineRunFilters)[] = [];

  const allFilterKeys: (keyof PipelineRunFilters)[] = [
    "status",
    "created_by",
    "created_after",
    "created_before",
    "pipeline_name",
    "annotations",
  ];

  for (const key of allFilterKeys) {
    const value = filters[key];
    const hasValue =
      value !== undefined &&
      value !== null &&
      value !== "" &&
      !(Array.isArray(value) && value.length === 0);

    if (hasValue && !SUPPORTED_API_FILTERS.includes(key)) {
      unsupported.push(key);
    }
  }

  return unsupported;
}
