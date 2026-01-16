import { useMemo, useState } from "react";

import type {
  ContainerExecutionStatus,
  PipelineRunResponse,
} from "@/api/types.gen";
import { convertUTCToLocalTime } from "@/utils/date";
import { getOverallExecutionStatusFromStats } from "@/utils/executionStatus";

export type RunSortField = "date" | "name" | "status";
type SortDirection = "asc" | "desc";
export type RunDateFilter = "all" | "today" | "week" | "month";

/**
 * Subset of ContainerExecutionStatus values that represent overall run states
 * (simplified for filtering purposes).
 */
export type RunStatusFilter =
  | "all"
  | "SUCCEEDED"
  | "FAILED"
  | "RUNNING"
  | "PENDING"
  | "CANCELLED"
  | "SYSTEM_ERROR";

export interface RunFilters {
  searchQuery: string;
  sortField: RunSortField;
  sortDirection: SortDirection;
  dateFilter: RunDateFilter;
  statusFilter: RunStatusFilter;
}

const DEFAULT_FILTERS: RunFilters = {
  searchQuery: "",
  sortField: "date",
  sortDirection: "desc",
  dateFilter: "all",
  statusFilter: "all",
};

/**
 * Filter capability metadata - indicates what can be done server-side vs client-side.
 * "trapdoor" filters only work on the current page of results.
 */
export const FILTER_CAPABILITIES = {
  searchQuery: { isTrapdoor: true, label: "Search" },
  sortField: { isTrapdoor: true, label: "Sort" },
  dateFilter: { isTrapdoor: true, label: "Date range" },
  statusFilter: { isTrapdoor: true, label: "Status" },
  createdBy: { isTrapdoor: false, label: "Created by" },
} as const;

function isWithinDateRange(
  dateString: string | null | undefined,
  filter: RunDateFilter,
): boolean {
  if (filter === "all" || !dateString) return true;

  const date = convertUTCToLocalTime(dateString);
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

function matchesStatusFilter(
  executionStatusStats: Record<string, number> | null | undefined,
  filter: RunStatusFilter,
): boolean {
  if (filter === "all") return true;

  const overallStatus =
    getOverallExecutionStatusFromStats(executionStatusStats);
  if (!overallStatus) return false;

  // Map "in progress" statuses to RUNNING or PENDING for simplified filtering
  const inProgressStatuses: ContainerExecutionStatus[] = [
    "RUNNING",
    "PENDING",
    "QUEUED",
    "WAITING_FOR_UPSTREAM",
    "CANCELLING",
    "UNINITIALIZED",
  ];

  if (filter === "RUNNING") {
    return inProgressStatuses.includes(
      overallStatus as ContainerExecutionStatus,
    );
  }

  if (filter === "PENDING") {
    return (
      overallStatus === "PENDING" ||
      overallStatus === "QUEUED" ||
      overallStatus === "WAITING_FOR_UPSTREAM"
    );
  }

  return overallStatus === filter;
}

function matchesSearchQuery(run: PipelineRunResponse, query: string): boolean {
  if (!query) return true;

  const lowerQuery = query.toLowerCase();
  const name = run.pipeline_name?.toLowerCase() ?? "";
  const id = run.id.toLowerCase();

  return name.includes(lowerQuery) || id.includes(lowerQuery);
}

const STATUS_PRIORITY: Record<string, number> = {
  SYSTEM_ERROR: 0,
  FAILED: 1,
  CANCELLING: 2,
  CANCELLED: 3,
  RUNNING: 4,
  PENDING: 5,
  QUEUED: 6,
  WAITING_FOR_UPSTREAM: 7,
  UNINITIALIZED: 8,
  SKIPPED: 9,
  SUCCEEDED: 10,
};

function compareRuns(
  a: PipelineRunResponse,
  b: PipelineRunResponse,
  sortField: RunSortField,
  sortDirection: SortDirection,
): number {
  let comparison = 0;

  switch (sortField) {
    case "name": {
      const aName = a.pipeline_name ?? "";
      const bName = b.pipeline_name ?? "";
      comparison = aName.localeCompare(bName);
      break;
    }
    case "date": {
      const aDate = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bDate = b.created_at ? new Date(b.created_at).getTime() : 0;
      comparison = aDate - bDate;
      break;
    }
    case "status": {
      const aStatus =
        getOverallExecutionStatusFromStats(a.execution_status_stats) ??
        "UNKNOWN";
      const bStatus =
        getOverallExecutionStatusFromStats(b.execution_status_stats) ??
        "UNKNOWN";
      const aPriority = STATUS_PRIORITY[aStatus] ?? 99;
      const bPriority = STATUS_PRIORITY[bStatus] ?? 99;
      comparison = aPriority - bPriority;
      break;
    }
  }

  return sortDirection === "asc" ? comparison : -comparison;
}

export function useRunFilters(runs: PipelineRunResponse[]) {
  const [filters, setFilters] = useState<RunFilters>(DEFAULT_FILTERS);

  const filteredAndSortedRuns = useMemo(() => {
    return runs
      .filter((run) => {
        if (!matchesSearchQuery(run, filters.searchQuery)) {
          return false;
        }

        if (!isWithinDateRange(run.created_at, filters.dateFilter)) {
          return false;
        }

        if (
          !matchesStatusFilter(run.execution_status_stats, filters.statusFilter)
        ) {
          return false;
        }

        return true;
      })
      .sort((a, b) =>
        compareRuns(a, b, filters.sortField, filters.sortDirection),
      );
  }, [runs, filters]);

  const hasActiveFilters =
    filters.searchQuery !== "" ||
    filters.dateFilter !== "all" ||
    filters.statusFilter !== "all";

  const activeFilterCount = [
    filters.searchQuery !== "",
    filters.dateFilter !== "all",
    filters.statusFilter !== "all",
  ].filter(Boolean).length;

  const clearFilters = () => {
    setFilters(DEFAULT_FILTERS);
  };

  const updateFilter = <K extends keyof RunFilters>(
    key: K,
    value: RunFilters[K],
  ) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  return {
    filters,
    filteredAndSortedRuns,
    hasActiveFilters,
    activeFilterCount,
    clearFilters,
    updateFilter,
  };
}
