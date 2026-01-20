import type { ChangeEvent, ReactNode } from "react";
import type { DateRange } from "react-day-picker";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DatePickerWithRange } from "@/components/ui/date-picker";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InlineStack } from "@/components/ui/layout";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Text } from "@/components/ui/typography";

import type { PipelineFilters, SortField } from "./usePipelineFilters";

interface PipelineFiltersBarProps {
  filters: PipelineFilters;
  hasActiveFilters: boolean;
  activeFilterCount: number;
  onUpdateFilter: <K extends keyof PipelineFilters>(
    key: K,
    value: PipelineFilters[K],
  ) => void;
  onClearFilters: () => void;
  totalCount?: number;
  filteredCount?: number;
  actions?: ReactNode;
}

const SORT_OPTIONS: { value: SortField; label: string }[] = [
  { value: "modified", label: "Modified date" },
  { value: "name", label: "Name" },
  { value: "lastRun", label: "Last run" },
];

export function PipelineFiltersBar({
  filters,
  hasActiveFilters,
  activeFilterCount,
  onUpdateFilter,
  onClearFilters,
  totalCount,
  filteredCount,
  actions,
}: PipelineFiltersBarProps) {
  const handleSearchChange = (e: ChangeEvent<HTMLInputElement>) => {
    onUpdateFilter("searchQuery", e.target.value);
  };

  const handleSortChange = (value: string) => {
    onUpdateFilter("sortField", value as SortField);
  };

  const handleSortDirectionToggle = () => {
    onUpdateFilter(
      "sortDirection",
      filters.sortDirection === "asc" ? "desc" : "asc",
    );
  };

  const handleDateRangeChange = (range: DateRange | undefined) => {
    onUpdateFilter("dateRange", range);
  };

  const handleHasRunsToggle = (checked: boolean) => {
    onUpdateFilter("hasRunsOnly", checked);
  };

  const sortDirectionIcon: "ArrowUp" | "ArrowDown" =
    filters.sortDirection === "asc" ? "ArrowUp" : "ArrowDown";

  const showResultsCount =
    totalCount !== undefined &&
    filteredCount !== undefined &&
    filteredCount < totalCount;

  return (
    <InlineStack
      gap="3"
      blockAlign="center"
      wrap="wrap"
      className="rounded-lg p-3"
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
            placeholder="Search pipelines..."
            value={filters.searchQuery}
            onChange={handleSearchChange}
            className="w-48 pl-8"
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
          <SelectTrigger className="w-28 h-9">
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
      <InlineStack gap="3" blockAlign="center">
        <DatePickerWithRange
          value={filters.dateRange}
          onChange={handleDateRangeChange}
          placeholder="All time"
        />

        <InlineStack gap="2" blockAlign="center">
          <Switch
            id="has-runs"
            checked={filters.hasRunsOnly}
            onCheckedChange={handleHasRunsToggle}
          />
          <Label htmlFor="has-runs" className="whitespace-nowrap text-sm">
            Has runs
          </Label>
        </InlineStack>
      </InlineStack>

      {/* Results count & clear */}
      {(hasActiveFilters || showResultsCount) && (
        <InlineStack gap="2" blockAlign="center">
          {showResultsCount && (
            <Text as="span" size="xs" tone="subdued">
              {filteredCount} of {totalCount}
            </Text>
          )}
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearFilters}
              className="h-8 gap-1"
            >
              Clear
              <Badge variant="secondary" size="xs">
                {activeFilterCount}
              </Badge>
            </Button>
          )}
        </InlineStack>
      )}

      {/* Actions (pushed to right) */}
      {actions && <div className="ml-auto">{actions}</div>}
    </InlineStack>
  );
}
