import { useLocation, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

import type { PipelineRunFilters } from "@/types/pipelineRunFilters";
import {
  countActiveFilters,
  isRecord,
  serializeFiltersToUrl,
  validateFilters,
} from "@/utils/pipelineRunFilterUtils";

const DEBOUNCE_MS = 500;

function parseFilterString(value: string): PipelineRunFilters {
  try {
    return validateFilters(JSON.parse(value));
  } catch {
    return {};
  }
}

function getFiltersFromSearch(search: unknown): PipelineRunFilters {
  const rawFilter = isRecord(search) ? search.filter : undefined;
  if (typeof rawFilter === "string") return parseFilterString(rawFilter);
  if (isRecord(rawFilter)) return validateFilters(rawFilter);
  return {};
}

function withFilterChange<K extends keyof PipelineRunFilters>(
  current: PipelineRunFilters,
  key: K,
  value: PipelineRunFilters[K],
): PipelineRunFilters {
  const next = { ...current };
  if (value === undefined || value === null || value === "") {
    delete next[key];
  } else {
    next[key] = value;
  }
  return next;
}

interface UseRunSearchParamsReturn {
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

  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  const filters = getFiltersFromSearch(search);
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  const updateUrl = (newFilters: PipelineRunFilters) => {
    const filter = serializeFiltersToUrl(newFilters);
    navigate({ to: pathname, search: filter ? { filter } : {} });
  };

  const setFilter = <K extends keyof PipelineRunFilters>(
    key: K,
    value: PipelineRunFilters[K],
  ) => {
    updateUrl(withFilterChange(filters, key, value));
  };

  const setFilters = (newFilters: Partial<PipelineRunFilters>) => {
    updateUrl({ ...filters, ...newFilters });
  };

  const setFilterDebounced = <K extends keyof PipelineRunFilters>(
    key: K,
    value: PipelineRunFilters[K],
  ) => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    debounceTimeoutRef.current = setTimeout(() => {
      updateUrl(withFilterChange(filtersRef.current, key, value));
      debounceTimeoutRef.current = null;
    }, DEBOUNCE_MS);
  };

  const clearFilters = () => updateUrl({});

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
