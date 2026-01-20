import type { PipelineRunSummary } from "@/services/pipelineRunService";
import type { ComponentFileEntry } from "@/utils/componentStore";

export type SortField = "name" | "modified" | "lastRun";
export type SortDirection = "asc" | "desc";

export interface DateRange {
  from: Date | undefined;
  to?: Date | undefined;
}

export interface PipelineFilters {
  searchQuery: string;
  sortField: SortField;
  sortDirection: SortDirection;
  dateRange: DateRange | undefined;
  hasRunsOnly: boolean;
}

interface PipelineWithRunInfo {
  name: string;
  fileEntry: ComponentFileEntry;
  runSummary: PipelineRunSummary | null;
}

export const DEFAULT_FILTERS: PipelineFilters = {
  searchQuery: "",
  sortField: "modified",
  sortDirection: "desc",
  dateRange: undefined,
  hasRunsOnly: false,
};

interface UsePipelineFiltersOptions {
  filters: PipelineFilters;
  onFiltersChange: (filters: PipelineFilters) => void;
}

function isWithinDateRange(date: Date, range: DateRange | undefined): boolean {
  if (!range || !range.from) return true;

  const dateOnly = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );
  const fromDate = new Date(
    range.from.getFullYear(),
    range.from.getMonth(),
    range.from.getDate(),
  );

  if (range.to) {
    const toDate = new Date(
      range.to.getFullYear(),
      range.to.getMonth(),
      range.to.getDate(),
    );
    return dateOnly >= fromDate && dateOnly <= toDate;
  }

  return dateOnly >= fromDate;
}

function comparePipelines(
  a: PipelineWithRunInfo,
  b: PipelineWithRunInfo,
  sortField: SortField,
  sortDirection: SortDirection,
): number {
  let comparison = 0;

  switch (sortField) {
    case "name":
      comparison = a.name.localeCompare(b.name);
      break;
    case "modified":
      comparison =
        new Date(a.fileEntry.modificationTime).getTime() -
        new Date(b.fileEntry.modificationTime).getTime();
      break;
    case "lastRun": {
      const aDate = a.runSummary?.latestRunDate?.getTime() ?? 0;
      const bDate = b.runSummary?.latestRunDate?.getTime() ?? 0;
      comparison = aDate - bDate;
      break;
    }
  }

  return sortDirection === "asc" ? comparison : -comparison;
}

export function usePipelineFilters(
  pipelines: Map<string, ComponentFileEntry>,
  runSummaries: Map<string, PipelineRunSummary>,
  options: UsePipelineFiltersOptions,
) {
  const { filters, onFiltersChange } = options;

  const pipelinesWithRunInfo: PipelineWithRunInfo[] = Array.from(
    pipelines.entries(),
  ).map(([name, fileEntry]) => ({
    name,
    fileEntry,
    runSummary: runSummaries.get(name) ?? null,
  }));

  const filteredAndSortedPipelines = pipelinesWithRunInfo
    .filter((pipeline) => {
      if (
        filters.searchQuery &&
        !pipeline.name.toLowerCase().includes(filters.searchQuery.toLowerCase())
      ) {
        return false;
      }

      if (filters.hasRunsOnly && !pipeline.runSummary) {
        return false;
      }

      if (
        !isWithinDateRange(
          new Date(pipeline.fileEntry.modificationTime),
          filters.dateRange,
        )
      ) {
        return false;
      }

      return true;
    })
    .sort((a, b) =>
      comparePipelines(a, b, filters.sortField, filters.sortDirection),
    );

  const hasDateRange = Boolean(filters.dateRange?.from);

  const hasActiveFilters =
    filters.searchQuery !== "" || hasDateRange || filters.hasRunsOnly;

  const activeFilterCount = [
    filters.searchQuery !== "",
    hasDateRange,
    filters.hasRunsOnly,
  ].filter(Boolean).length;

  const filterKey = `${filters.searchQuery}-${filters.sortField}-${filters.sortDirection}-${filters.dateRange?.from?.toISOString()}-${filters.dateRange?.to?.toISOString()}-${filters.hasRunsOnly}`;

  const clearFilters = () => {
    onFiltersChange(DEFAULT_FILTERS);
  };

  const updateFilter = <K extends keyof PipelineFilters>(
    key: K,
    value: PipelineFilters[K],
  ) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  return {
    filters,
    filterKey,
    filteredAndSortedPipelines,
    hasActiveFilters,
    activeFilterCount,
    clearFilters,
    updateFilter,
  };
}
