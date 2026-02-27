import { useState } from "react";
import type { DateRange } from "react-day-picker";

import type { ComponentFileEntry } from "@/utils/componentStore";

export type PipelineSortField = "modified_at" | "name";
export type PipelineSortDirection = "asc" | "desc";

type PipelineEntry = [string, ComponentFileEntry];

export interface FilterBarProps {
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  dateRange: DateRange | undefined;
  setDateRange: (v: DateRange | undefined) => void;
  sortField: PipelineSortField;
  setSortField: (v: PipelineSortField) => void;
  sortDirection: PipelineSortDirection;
  setSortDirection: (v: PipelineSortDirection) => void;
  componentQuery: string;
  setComponentQuery: (v: string) => void;
  hasActiveFilters: boolean;
  activeFilterCount: number;
  clearFilters: () => void;
  totalCount: number;
  filteredCount: number;
}

function matchesComponentQuery(
  fileEntry: ComponentFileEntry,
  query: string,
): boolean {
  const impl = fileEntry.componentRef.spec.implementation;
  if (!("graph" in impl)) return false;
  const q = query.toLowerCase();
  return Object.values(impl.graph.tasks).some((task) => {
    const url = task.componentRef.url?.toLowerCase() ?? "";
    const refName = task.componentRef.name?.toLowerCase() ?? "";
    const specName = task.componentRef.spec?.name?.toLowerCase() ?? "";
    return url.includes(q) || refName.includes(q) || specName.includes(q);
  });
}

function matchesSearch(
  name: string,
  fileEntry: ComponentFileEntry,
  query: string,
): boolean {
  const q = query.toLowerCase();
  const spec = fileEntry.componentRef.spec;
  const description = spec.description?.toLowerCase() ?? "";
  const author = spec.metadata?.annotations?.author?.toLowerCase() ?? "";
  const rawNotes = spec.metadata?.annotations?.["notes"];
  const notes = typeof rawNotes === "string" ? rawNotes.toLowerCase() : "";
  return (
    name.toLowerCase().includes(q) ||
    description.includes(q) ||
    author.includes(q) ||
    notes.includes(q)
  );
}

function matchesDateRange(
  fileEntry: ComponentFileEntry,
  dateRange: DateRange | undefined,
): boolean {
  if (dateRange?.from) {
    if (new Date(fileEntry.modificationTime) < dateRange.from) return false;
  }
  if (dateRange?.to) {
    const to = new Date(dateRange.to);
    to.setDate(to.getDate() + 1);
    if (new Date(fileEntry.modificationTime) > to) return false;
  }
  return true;
}

export function usePipelineFilters(
  pipelines: Map<string, ComponentFileEntry>,
) {
  const [searchQuery, setSearchQuery] = useState("");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [sortField, setSortField] = useState<PipelineSortField>("modified_at");
  const [sortDirection, setSortDirection] =
    useState<PipelineSortDirection>("desc");
  const [componentQuery, setComponentQuery] = useState("");

  const hasActiveFilters = !!searchQuery || !!dateRange || !!componentQuery;
  const activeFilterCount = [searchQuery, dateRange, componentQuery].filter(
    Boolean,
  ).length;

  const clearFilters = () => {
    setSearchQuery("");
    setDateRange(undefined);
    setComponentQuery("");
  };

  const filteredPipelines: PipelineEntry[] = Array.from(pipelines.entries())
    .filter(([name, fileEntry]) => {
      if (searchQuery && !matchesSearch(name, fileEntry, searchQuery))
        return false;
      if (!matchesDateRange(fileEntry, dateRange)) return false;
      if (
        componentQuery &&
        !matchesComponentQuery(fileEntry, componentQuery)
      )
        return false;
      return true;
    })
    .sort(([nameA, entryA], [nameB, entryB]) => {
      const dir = sortDirection === "asc" ? 1 : -1;
      if (sortField === "name") return dir * nameA.localeCompare(nameB);
      return (
        dir *
        (new Date(entryA.modificationTime).getTime() -
          new Date(entryB.modificationTime).getTime())
      );
    });

  const filterBarProps: FilterBarProps = {
    searchQuery,
    setSearchQuery,
    dateRange,
    setDateRange,
    sortField,
    setSortField,
    sortDirection,
    setSortDirection,
    componentQuery,
    setComponentQuery,
    hasActiveFilters,
    activeFilterCount,
    clearFilters,
    totalCount: pipelines.size,
    filteredCount: filteredPipelines.length,
  };

  return { filteredPipelines, filterBarProps };
}
