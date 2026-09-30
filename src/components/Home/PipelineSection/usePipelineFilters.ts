import { useState } from "react";
import type { DateRange } from "react-day-picker";

import { isGraphImplementation } from "@/utils/componentSpec";
import type { ComponentFileEntry } from "@/utils/componentStore";

export type PipelineSortField = "modified_at" | "name";
type PipelineSortDirection = "asc" | "desc";

export interface MatchedField {
  label: string;
  value: string;
}

interface PipelineMatchMetadata {
  searchQuery: string;
  matchedFields: MatchedField[];
  componentQuery: string;
  matchedComponentNames: string[];
}

type PipelineEntry = [string, ComponentFileEntry, PipelineMatchMetadata];

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
  if (!query) return true;
  const impl = fileEntry.componentRef.spec.implementation;
  if (!isGraphImplementation(impl)) return false;
  const normalizedQuery = query.toLowerCase();
  return Object.values(impl.graph.tasks).some((task) => {
    const refName = task.componentRef.name?.toLowerCase() ?? "";
    const specName = task.componentRef.spec?.name?.toLowerCase() ?? "";
    return (
      refName.includes(normalizedQuery) || specName.includes(normalizedQuery)
    );
  });
}

function matchesSearch(
  name: string,
  fileEntry: ComponentFileEntry,
  query: string,
): boolean {
  if (!query) return true;
  const normalizedQuery = query.toLowerCase();
  const spec = fileEntry.componentRef.spec;
  const description = spec.description?.toLowerCase() ?? "";
  const author = spec.metadata?.annotations?.author?.toLowerCase() ?? "";
  const rawNotes = spec.metadata?.annotations?.["notes"];
  const notes = typeof rawNotes === "string" ? rawNotes.toLowerCase() : "";
  return (
    name.toLowerCase().includes(normalizedQuery) ||
    description.includes(normalizedQuery) ||
    author.includes(normalizedQuery) ||
    notes.includes(normalizedQuery)
  );
}

function getMatchMetadata(
  fileEntry: ComponentFileEntry,
  searchQuery: string,
  componentQuery: string,
): PipelineMatchMetadata {
  const matchedFields: MatchedField[] = [];
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    const spec = fileEntry.componentRef.spec;
    const desc = spec.description ?? "";
    if (desc.toLowerCase().includes(q)) {
      matchedFields.push({ label: "Description", value: desc });
    }
    const author = spec.metadata?.annotations?.author ?? "";
    if (author.toLowerCase().includes(q)) {
      matchedFields.push({ label: "Author", value: author });
    }
    const rawNotes = spec.metadata?.annotations?.["notes"];
    const notes = typeof rawNotes === "string" ? rawNotes : "";
    if (notes.toLowerCase().includes(q)) {
      matchedFields.push({ label: "Note", value: notes });
    }
  }

  const matchedComponentNames: string[] = [];
  const impl = fileEntry.componentRef.spec.implementation;
  if (componentQuery && isGraphImplementation(impl)) {
    const normalizedQuery = componentQuery.toLowerCase();
    const seen = new Set<string>();
    for (const task of Object.values(impl.graph.tasks)) {
      const refName = task.componentRef.name ?? "";
      const specName = task.componentRef.spec?.name ?? "";
      for (const name of [refName, specName]) {
        if (!name || seen.has(name)) continue;
        if (!name.toLowerCase().includes(normalizedQuery)) continue;
        seen.add(name);
        matchedComponentNames.push(name);
      }
    }
  }

  return {
    searchQuery,
    matchedFields,
    componentQuery,
    matchedComponentNames,
  };
}

function matchesDateRange(
  fileEntry: ComponentFileEntry,
  dateRange: DateRange | undefined,
): boolean {
  if (!dateRange) return true;

  const modificationTime = new Date(fileEntry.modificationTime);

  if (dateRange.from && modificationTime < dateRange.from) return false;

  if (dateRange.to) {
    const endOfRange = new Date(dateRange.to);
    endOfRange.setDate(endOfRange.getDate() + 1);
    if (modificationTime > endOfRange) return false;
  }

  return true;
}

export function usePipelineFilters(pipelines: Map<string, ComponentFileEntry>) {
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
    .filter(
      ([name, fileEntry]) =>
        matchesSearch(name, fileEntry, searchQuery) &&
        matchesDateRange(fileEntry, dateRange) &&
        matchesComponentQuery(fileEntry, componentQuery),
    )
    .sort(([nameA, entryA], [nameB, entryB]) => {
      const dir = sortDirection === "asc" ? 1 : -1;
      if (sortField === "name") return dir * nameA.localeCompare(nameB);
      return (
        dir *
        (new Date(entryA.modificationTime).getTime() -
          new Date(entryB.modificationTime).getTime())
      );
    })
    .map(
      ([name, fileEntry]): PipelineEntry => [
        name,
        fileEntry,
        getMatchMetadata(fileEntry, searchQuery, componentQuery),
      ],
    );

  const filterKey = [
    searchQuery,
    dateRange?.from?.getTime(),
    dateRange?.to?.getTime(),
    componentQuery,
    sortField,
    sortDirection,
  ].join("|");

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

  return { filteredPipelines, filterBarProps, filterKey };
}
