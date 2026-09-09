import { useState } from "react";
import type { DateRange } from "react-day-picker";

import {
  type ComponentSpec,
  isGraphImplementation,
} from "@/utils/componentSpec";

import type { PipelineListEntry } from "./usePipelineListEntries";

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

interface FilteredPipeline {
  entry: PipelineListEntry;
  match: PipelineMatchMetadata;
}

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
  pendingCount: number;
}

function matchesComponentQuery(
  spec: ComponentSpec | undefined,
  query: string,
): boolean {
  if (!query) return true;
  const impl = spec?.implementation;
  if (!impl || !isGraphImplementation(impl)) return false;
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
  spec: ComponentSpec | undefined,
  query: string,
): boolean {
  if (!query) return true;
  const normalizedQuery = query.toLowerCase();
  const description = spec?.description?.toLowerCase() ?? "";
  const author = spec?.metadata?.annotations?.author?.toLowerCase() ?? "";
  const rawNotes = spec?.metadata?.annotations?.["notes"];
  const notes = typeof rawNotes === "string" ? rawNotes.toLowerCase() : "";
  return (
    name.toLowerCase().includes(normalizedQuery) ||
    description.includes(normalizedQuery) ||
    author.includes(normalizedQuery) ||
    notes.includes(normalizedQuery)
  );
}

function getMatchMetadata(
  spec: ComponentSpec | undefined,
  searchQuery: string,
  componentQuery: string,
): PipelineMatchMetadata {
  const matchedFields: MatchedField[] = [];
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    const desc = spec?.description ?? "";
    if (desc.toLowerCase().includes(q)) {
      matchedFields.push({ label: "Description", value: desc });
    }
    const author = spec?.metadata?.annotations?.author ?? "";
    if (author.toLowerCase().includes(q)) {
      matchedFields.push({ label: "Author", value: author });
    }
    const rawNotes = spec?.metadata?.annotations?.["notes"];
    const notes = typeof rawNotes === "string" ? rawNotes : "";
    if (notes.toLowerCase().includes(q)) {
      matchedFields.push({ label: "Note", value: notes });
    }
  }

  const matchedComponentNames: string[] = [];
  const impl = spec?.implementation;
  if (componentQuery && impl && isGraphImplementation(impl)) {
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
  modifiedAt: Date | undefined,
  dateRange: DateRange | undefined,
): boolean {
  if (!dateRange) return true;
  if (!modifiedAt) return false;

  if (dateRange.from && modifiedAt < dateRange.from) return false;

  if (dateRange.to) {
    const endOfRange = new Date(dateRange.to);
    endOfRange.setDate(endOfRange.getDate() + 1);
    if (modifiedAt > endOfRange) return false;
  }

  return true;
}

export function usePipelineFilters(
  entries: PipelineListEntry[],
  pendingCount: number,
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

  const filteredPipelines: FilteredPipeline[] = entries
    .filter(
      ({ file, spec }) =>
        matchesSearch(file.displayName, spec, searchQuery) &&
        matchesDateRange(file.modifiedAt, dateRange) &&
        matchesComponentQuery(spec, componentQuery),
    )
    .sort((a, b) => {
      const dir = sortDirection === "asc" ? 1 : -1;
      if (sortField === "name") {
        return dir * a.file.displayName.localeCompare(b.file.displayName);
      }
      return (
        dir *
        ((a.file.modifiedAt?.getTime() ?? 0) -
          (b.file.modifiedAt?.getTime() ?? 0))
      );
    })
    .map((entry) => ({
      entry,
      match: getMatchMetadata(entry.spec, searchQuery, componentQuery),
    }));

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
    totalCount: entries.length,
    filteredCount: filteredPipelines.length,
    pendingCount,
  };

  return { filteredPipelines, filterBarProps, filterKey };
}
