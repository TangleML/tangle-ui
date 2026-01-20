import type { ChangeEvent } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { InlineStack } from "@/components/ui/layout";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Text } from "@/components/ui/typography";

import type {
  RunDateFilter,
  RunFilters,
  RunSortField,
  RunStatusFilter,
} from "./useRunFilters";

interface RunFiltersBarProps {
  filters: RunFilters;
  hasActiveFilters: boolean;
  activeFilterCount: number;
  onUpdateFilter: <K extends keyof RunFilters>(
    key: K,
    value: RunFilters[K],
  ) => void;
  onClearFilters: () => void;
  totalCount: number;
  filteredCount: number;
}

const SORT_OPTIONS: { value: RunSortField; label: string }[] = [
  { value: "date", label: "Date" },
  { value: "name", label: "Name" },
  { value: "status", label: "Status" },
];

const DATE_FILTER_OPTIONS: { value: RunDateFilter; label: string }[] = [
  { value: "all", label: "All time" },
  { value: "today", label: "Today" },
  { value: "week", label: "Last 7 days" },
  { value: "month", label: "Last 30 days" },
];

const STATUS_FILTER_OPTIONS: { value: RunStatusFilter; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "SUCCEEDED", label: "Succeeded" },
  { value: "FAILED", label: "Failed" },
  { value: "RUNNING", label: "Running" },
  { value: "PENDING", label: "Pending" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "SYSTEM_ERROR", label: "System error" },
];

export function RunFiltersBar({
  filters,
  hasActiveFilters,
  activeFilterCount,
  onUpdateFilter,
  onClearFilters,
  totalCount,
  filteredCount,
}: RunFiltersBarProps) {
  const handleSearchChange = (e: ChangeEvent<HTMLInputElement>) => {
    onUpdateFilter("searchQuery", e.target.value);
  };

  const handleSortChange = (value: string) => {
    onUpdateFilter("sortField", value as RunSortField);
  };

  const handleSortDirectionToggle = () => {
    onUpdateFilter(
      "sortDirection",
      filters.sortDirection === "asc" ? "desc" : "asc",
    );
  };

  const handleDateFilterChange = (value: string) => {
    onUpdateFilter("dateFilter", value as RunDateFilter);
  };

  const handleStatusFilterChange = (value: string) => {
    onUpdateFilter("statusFilter", value as RunStatusFilter);
  };

  const sortDirectionIcon: "ArrowUp" | "ArrowDown" =
    filters.sortDirection === "asc" ? "ArrowUp" : "ArrowDown";

  const isFiltered = filteredCount < totalCount;

  return (
    <InlineStack
      gap="3"
      blockAlign="center"
      wrap="wrap"
      className="rounded-lg p-3 mb-4"
    >
      {/* Search */}
      <InlineStack gap="1" wrap="nowrap">
        <div className="relative">
          <Icon
            name="Search"
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4"
          />
          <Input
            type="text"
            placeholder="Search runs..."
            value={filters.searchQuery}
            onChange={handleSearchChange}
            className="w-48 pl-8"
            data-testid="run-search-input"
          />
        </div>
        {filters.searchQuery && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onUpdateFilter("searchQuery", "")}
            className="h-9 w-9"
          >
            <Icon name="X" className="w-4 h-4" />
          </Button>
        )}
      </InlineStack>

      <Separator orientation="vertical" className="h-6" />

      {/* Sort */}
      <InlineStack gap="1" wrap="nowrap" blockAlign="center">
        <Text as="span" size="xs" tone="subdued" className="whitespace-nowrap">
          Sort by
        </Text>
        <Select value={filters.sortField} onValueChange={handleSortChange}>
          <SelectTrigger className="w-24 h-9" data-testid="run-sort-select">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleSortDirectionToggle}
          title={filters.sortDirection === "asc" ? "Ascending" : "Descending"}
          className="h-9 w-9"
        >
          <Icon name={sortDirectionIcon} className="w-4 h-4" />
        </Button>
      </InlineStack>

      <Separator orientation="vertical" className="h-6" />

      {/* Filters */}
      <InlineStack gap="2" blockAlign="center">
        <Select
          value={filters.dateFilter}
          onValueChange={handleDateFilterChange}
        >
          <SelectTrigger
            className="w-28 h-9"
            data-testid="run-date-filter-select"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DATE_FILTER_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.statusFilter}
          onValueChange={handleStatusFilterChange}
        >
          <SelectTrigger
            className="w-32 h-9"
            data-testid="run-status-filter-select"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_FILTER_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </InlineStack>

      {/* Results count & clear */}
      {(hasActiveFilters || isFiltered) && (
        <>
          <Separator orientation="vertical" className="h-6" />
          <InlineStack gap="2" blockAlign="center">
            {isFiltered && (
              <Text as="span" size="xs" tone="subdued">
                {filteredCount} of {totalCount}
              </Text>
            )}
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClearFilters}
                data-testid="run-clear-filters"
                className="h-8 gap-1"
              >
                Clear
                <Badge variant="secondary" size="xs">
                  {activeFilterCount}
                </Badge>
              </Button>
            )}
          </InlineStack>
        </>
      )}

      {/* Preview notice */}
      <div className="ml-auto">
        <Text as="span" size="xs" tone="subdued" className="flex items-center gap-1">
          <Icon name="FlaskConical" className="w-3 h-3" />
          Client-side filtering
        </Text>
      </div>
    </InlineStack>
  );
}
