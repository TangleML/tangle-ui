import { useState } from "react";

import type { PipelineRunSummary } from "@/services/pipelineRunService";
import type { ComponentFileEntry } from "@/utils/componentStore";

export type SortField = "name" | "modified" | "lastRun";
type SortDirection = "asc" | "desc";
export type DateFilter = "all" | "today" | "week" | "month";

export interface PipelineFilters {
  searchQuery: string;
  sortField: SortField;
  sortDirection: SortDirection;
  dateFilter: DateFilter;
  hasRunsOnly: boolean;
}

interface PipelineWithRunInfo {
  name: string;
  fileEntry: ComponentFileEntry;
  runSummary: PipelineRunSummary | null;
}

const DEFAULT_FILTERS: PipelineFilters = {
  searchQuery: "",
  sortField: "modified",
  sortDirection: "desc",
  dateFilter: "all",
  hasRunsOnly: false,
};

function isWithinDateRange(date: Date, filter: DateFilter): boolean {
  if (filter === "all") return true;

  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );

  switch (filter) {
    case "today":
      return date >= startOfToday;
    case "week": {
      const startOfWeek = new Date(startOfToday);
      startOfWeek.setDate(startOfWeek.getDate() - 7);
      return date >= startOfWeek;
    }
    case "month": {
      const startOfMonth = new Date(startOfToday);
      startOfMonth.setDate(startOfMonth.getDate() - 30);
      return date >= startOfMonth;
    }
    default:
      return true;
  }
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
) {
  const [filters, setFilters] = useState<PipelineFilters>(DEFAULT_FILTERS);

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
        filters.dateFilter !== "all" &&
        !isWithinDateRange(
          new Date(pipeline.fileEntry.modificationTime),
          filters.dateFilter,
        )
      ) {
        return false;
      }

      return true;
    })
    .sort((a, b) =>
      comparePipelines(a, b, filters.sortField, filters.sortDirection),
    );

  const hasActiveFilters =
    filters.searchQuery !== "" ||
    filters.dateFilter !== "all" ||
    filters.hasRunsOnly;

  const activeFilterCount = [
    filters.searchQuery !== "",
    filters.dateFilter !== "all",
    filters.hasRunsOnly,
  ].filter(Boolean).length;

  const filterKey = `${filters.searchQuery}-${filters.sortField}-${filters.sortDirection}-${filters.dateFilter}-${filters.hasRunsOnly}`;

  const clearFilters = () => {
    setFilters(DEFAULT_FILTERS);
  };

  const updateFilter = <K extends keyof PipelineFilters>(
    key: K,
    value: PipelineFilters[K],
  ) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
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
