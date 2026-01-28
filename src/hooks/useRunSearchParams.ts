import { useLocation, useNavigate, useSearch } from "@tanstack/react-router";
import { useRef } from "react";

import type { PipelineRunFilters } from "@/types/pipelineRunFilters";
import { parseFilterParam } from "@/utils/pipelineRunFilterUtils";

const DEBOUNCE_MS = 300;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getStringOrUndefined(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

/**
 * Serialize PipelineRunFilters to a JSON string for URL query param.
 */
function serializeFiltersToUrl(
  filters: PipelineRunFilters,
): string | undefined {
  const cleaned = Object.fromEntries(
    Object.entries(filters).filter(([, value]) => {
      if (value === undefined || value === null || value === "") return false;
      if (Array.isArray(value) && value.length === 0) return false;
      return true;
    }),
  );

  return Object.keys(cleaned).length > 0 ? JSON.stringify(cleaned) : undefined;
}

/**
 * Count the number of active filters (excluding sort options).
 */
function countActiveFilters(filters: PipelineRunFilters): number {
  let count = 0;

  if (filters.status) count++;
  if (filters.created_by) count++;
  if (filters.created_after || filters.created_before) count++;
  if (filters.pipeline_name) count++;
  if (filters.annotations && filters.annotations.length > 0) {
    count += filters.annotations.length;
  }

  return count;
}

export interface UseRunSearchParamsReturn {
  filters: PipelineRunFilters;
  setFilter: <K extends keyof PipelineRunFilters>(
    key: K,
    value: PipelineRunFilters[K],
  ) => void;
  setFilters: (filters: Partial<PipelineRunFilters>) => void;
  setFilterDebounced: <K extends keyof PipelineRunFilters>(
    key: K,
    value: PipelineRunFilters[K],
  ) => void;
  clearFilters: () => void;
  hasActiveFilters: boolean;
  activeFilterCount: number;
}

/**
 * Hook to manage pipeline run search/filter state with URL synchronization.
 */
export function useRunSearchParams(): UseRunSearchParamsReturn {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const search: unknown = useSearch({ strict: false });
  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const filterParam = isRecord(search)
    ? getStringOrUndefined(search.filter)
    : undefined;
  // Use shared parser that handles both JSON (new) and key:value (legacy) formats
  const filters = parseFilterParam(filterParam);

  const updateUrl = (newFilters: PipelineRunFilters) => {
    const serialized = serializeFiltersToUrl(newFilters);
    const nextSearch: { filter?: string } = {};
    if (serialized) {
      nextSearch.filter = serialized;
    }
    navigate({ to: pathname, search: nextSearch });
  };

  const setFilter = <K extends keyof PipelineRunFilters>(
    key: K,
    value: PipelineRunFilters[K],
  ) => {
    const newFilters = { ...filters };

    if (value === undefined || value === null || value === "") {
      delete newFilters[key];
    } else {
      newFilters[key] = value;
    }

    updateUrl(newFilters);
  };

  const setFilters = (newFilters: Partial<PipelineRunFilters>) => {
    const merged: PipelineRunFilters = { ...filters, ...newFilters };

    // Remove empty values
    const cleaned = Object.fromEntries(
      Object.entries(merged).filter(([, value]) => {
        if (value === undefined || value === null || value === "") return false;
        if (Array.isArray(value) && value.length === 0) return false;
        return true;
      }),
    );

    updateUrl(cleaned);
  };

  const setFilterDebounced = <K extends keyof PipelineRunFilters>(
    key: K,
    value: PipelineRunFilters[K],
  ) => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    debounceTimeoutRef.current = setTimeout(() => {
      setFilter(key, value);
      debounceTimeoutRef.current = null;
    }, DEBOUNCE_MS);
  };

  const clearFilters = () => {
    navigate({ to: pathname, search: {} });
  };

  const activeFilterCount = countActiveFilters(filters);
  const hasActiveFilters = activeFilterCount > 0;

  return {
    filters,
    setFilter,
    setFilters,
    setFilterDebounced,
    clearFilters,
    hasActiveFilters,
    activeFilterCount,
  };
}
