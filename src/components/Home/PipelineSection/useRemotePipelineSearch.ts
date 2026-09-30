import { useNavigate, useSearch } from "@tanstack/react-router";
import { addDays, format, isValid, parseISO, startOfDay } from "date-fns";
import type { DateRange } from "react-day-picker";

import type {
  PipelineAnnotationFilter,
  PipelineSearchFilters,
  RemotePipelineSortDirection,
  RemotePipelineSortField,
} from "@/types/pipelineSearch";
import { isRecord } from "@/utils/typeGuards";

function readDate(value: unknown): Date | undefined {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return undefined;
  const date = parseISO(value);
  return isValid(date) ? date : undefined;
}

function readAnnotations(value: unknown): PipelineAnnotationFilter[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!isRecord(entry) || typeof entry.key !== "string" || !entry.key.trim())
      return [];
    if (entry.value !== undefined && typeof entry.value !== "string") return [];
    return [{ key: entry.key, value: entry.value }];
  });
}

export function useRemotePipelineSearch() {
  const navigate = useNavigate();
  const search: Record<string, unknown> = useSearch({ strict: false });
  const searchQuery = typeof search.q === "string" ? search.q : "";
  // An absent owner means "me"; an explicit empty owner means all owners.
  const userId = typeof search.owner === "string" ? search.owner : "me";
  const from = readDate(search.edited_from);
  const to = readDate(search.edited_to);
  const dateRange: DateRange | undefined =
    from || to ? { from, to } : undefined;
  const annotations = readAnnotations(search.annotations);
  const sortField: RemotePipelineSortField =
    search.sort_field === "name" ? "name" : "updated_at";
  const sortDirection: RemotePipelineSortDirection =
    search.sort_direction === "asc" ? "asc" : "desc";
  const filters: PipelineSearchFilters = {
    searchQuery: searchQuery.trim() || undefined,
    userId: userId.trim() || undefined,
    modifiedAfter: from ? startOfDay(from).toISOString() : undefined,
    modifiedBefore: to ? startOfDay(addDays(to, 1)).toISOString() : undefined,
    annotations: annotations.length ? annotations : undefined,
    sortField: sortField === "updated_at" ? undefined : sortField,
    sortDirection: sortDirection === "desc" ? undefined : sortDirection,
  };

  const updateSearch = (changes: Record<string, unknown>) => {
    void navigate({
      to: ".",
      search: (previous) => ({ ...previous, ...changes }),
      hash: true,
      replace: true,
      resetScroll: false,
      hashScrollIntoView: false,
    });
  };

  return {
    searchQuery,
    setSearchQuery: (value: string) => updateSearch({ q: value || undefined }),
    userId,
    setUserId: (value: string) =>
      updateSearch({ owner: value === "me" ? undefined : value }),
    dateRange,
    setDateRange: (value: DateRange | undefined) =>
      updateSearch({
        edited_from: value?.from ? format(value.from, "yyyy-MM-dd") : undefined,
        edited_to: value?.to ? format(value.to, "yyyy-MM-dd") : undefined,
      }),
    annotations,
    setAnnotations: (value: PipelineAnnotationFilter[]) =>
      updateSearch({ annotations: value.length ? value : undefined }),
    sortField,
    setSortField: (value: RemotePipelineSortField) =>
      updateSearch({ sort_field: value === "updated_at" ? undefined : value }),
    sortDirection,
    setSortDirection: (value: RemotePipelineSortDirection) =>
      updateSearch({ sort_direction: value === "desc" ? undefined : value }),
    clearFilters: () =>
      updateSearch({
        q: undefined,
        owner: undefined,
        edited_from: undefined,
        edited_to: undefined,
        annotations: undefined,
      }),
    filters,
  };
}
