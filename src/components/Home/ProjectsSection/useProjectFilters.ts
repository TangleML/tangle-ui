import { useState } from "react";
import type { DateRange } from "react-day-picker";

import type { ProjectSummary } from "@/services/projects/types";
import { addDays } from "@/utils/date";
import { containsSearchTerm } from "@/utils/searchUtils";

const CURRENT_USER_TOKEN = "me";

export interface ProjectFilterBarProps {
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  author: string | undefined;
  setAuthor: (value: string | undefined) => void;
  dateRange: DateRange | undefined;
  setDateRange: (value: DateRange | undefined) => void;
  hasActiveFilters: boolean;
  activeFilterCount: number;
  clearFilters: () => void;
  totalCount: number;
  filteredCount: number;
}

function matchesName(project: ProjectSummary, searchQuery: string): boolean {
  if (!searchQuery.trim()) return true;
  return containsSearchTerm(project.name, searchQuery);
}

function matchesAuthor(
  project: ProjectSummary,
  author: string | undefined,
  currentUserId: string | undefined,
): boolean {
  if (!author?.trim()) return true;

  const needle =
    author.trim().toLowerCase() === CURRENT_USER_TOKEN ? currentUserId : author;
  if (!needle) return false;

  return containsSearchTerm(project.createdBy ?? "", needle);
}

function matchesCreatedRange(
  project: ProjectSummary,
  dateRange: DateRange | undefined,
): boolean {
  if (!dateRange) return true;

  if (dateRange.from && project.createdAt < dateRange.from) return false;
  // The picker hands back midnight, so the closing day counts in full.
  if (dateRange.to && project.createdAt >= addDays(dateRange.to, 1)) {
    return false;
  }

  return true;
}

export function useProjectFilters(
  projects: ProjectSummary[],
  currentUserId: string | undefined,
) {
  const [searchQuery, setSearchQuery] = useState("");
  const [author, setAuthor] = useState<string | undefined>(undefined);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

  const filteredProjects = projects.filter(
    (project) =>
      matchesName(project, searchQuery) &&
      matchesAuthor(project, author, currentUserId) &&
      matchesCreatedRange(project, dateRange),
  );

  const activeFilters = [searchQuery.trim(), author?.trim(), dateRange].filter(
    Boolean,
  );

  const clearFilters = () => {
    setSearchQuery("");
    setAuthor(undefined);
    setDateRange(undefined);
  };

  const filterBarProps: ProjectFilterBarProps = {
    searchQuery,
    setSearchQuery,
    author,
    setAuthor,
    dateRange,
    setDateRange,
    hasActiveFilters: activeFilters.length > 0,
    activeFilterCount: activeFilters.length,
    clearFilters,
    totalCount: projects.length,
    filteredCount: filteredProjects.length,
  };

  return { filteredProjects, filterBarProps };
}
