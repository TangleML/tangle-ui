import type { ChangeEvent } from "react";
import type { DateRange } from "react-day-picker";

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

  return (
    <InlineStack gap="2" blockAlign="center" wrap="nowrap">
      <InlineStack gap="1" wrap="nowrap">
        <Input
          type="text"
          placeholder="Search..."
          value={filters.searchQuery}
          onChange={handleSearchChange}
          className="w-40"
        />
        {filters.searchQuery && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onUpdateFilter("searchQuery", "")}
          >
            <Icon name="CircleX" />
          </Button>
        )}
      </InlineStack>

      <InlineStack gap="1" wrap="nowrap" blockAlign="center">
        <Select value={filters.sortField} onValueChange={handleSortChange}>
          <SelectTrigger className="w-32">
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
          variant="outline"
          size="icon"
          onClick={handleSortDirectionToggle}
          title={filters.sortDirection === "asc" ? "Ascending" : "Descending"}
        >
          <Icon name={sortDirectionIcon} />
        </Button>
      </InlineStack>

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
        <Label htmlFor="has-runs" className="whitespace-nowrap">
          Has runs
        </Label>
      </InlineStack>

      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={onClearFilters}>
          <Icon name="X" />
          <Text
            as="span"
            size="xs"
            className="bg-muted px-1.5 py-0.5 rounded-full"
          >
            {activeFilterCount}
          </Text>
        </Button>
      )}
    </InlineStack>
  );
}
