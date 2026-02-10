import { format } from "date-fns";
import { useState } from "react";
import type { DateRange } from "react-day-picker";

import type { ContainerExecutionStatus } from "@/api/types.gen";
import { AnnotationFilterInput } from "@/components/shared/AnnotationFilterInput/AnnotationFilterInput";
import { CreatedByFilter } from "@/components/shared/CreatedByFilter/CreatedByFilter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { DatePickerWithRange } from "@/components/ui/date-picker";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Text } from "@/components/ui/typography";
import { useRunSearchParams } from "@/hooks/useRunSearchParams";
import type { AnnotationFilter, SortField } from "@/types/pipelineRunFilters";
import {
  EXECUTION_STATUS_LABELS,
  getExecutionStatusLabel,
} from "@/utils/executionStatus";

function isValidStatus(value: string): value is ContainerExecutionStatus {
  return value in EXECUTION_STATUS_LABELS;
}

const STATUS_OPTIONS = Object.keys(EXECUTION_STATUS_LABELS).filter(
  isValidStatus,
);

const SORT_FIELD_OPTIONS: { value: SortField; label: string }[] = [
  { value: "created_at", label: "Date" },
  { value: "pipeline_name", label: "Name" },
];

function isValidSortField(value: string): value is SortField {
  return SORT_FIELD_OPTIONS.some((option) => option.value === value);
}

const MAX_VISIBLE_BADGES = 4;

type FilterBadgeKey =
  | "status"
  | "pipeline_name"
  | "created_by"
  | "date_range"
  | `annotation-${number}`;

interface PipelineRunFiltersBarProps {
  totalCount?: number;
  filteredCount?: number;
}

export function PipelineRunFiltersBar({
  totalCount,
  filteredCount,
}: PipelineRunFiltersBarProps) {
  const {
    filters,
    setFilter,
    setFilters,
    setFilterDebounced,
    clearFilters,
    hasActiveFilters,
    activeFilterCount,
  } = useRunSearchParams();

  const [nameInput, setNameInput] = useState(filters.pipeline_name ?? "");
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [showAllBadges, setShowAllBadges] = useState(false);

  const createdAfter = filters.created_after
    ? new Date(filters.created_after)
    : undefined;
  const createdBefore = filters.created_before
    ? new Date(filters.created_before)
    : undefined;

  const dateRange: DateRange | undefined =
    createdAfter || createdBefore
      ? { from: createdAfter, to: createdBefore }
      : undefined;

  const handleDateRangeChange = (range: DateRange | undefined) => {
    setFilters({
      created_after: range?.from?.toISOString(),
      created_before: range?.to?.toISOString(),
    });
  };

  const handleAnnotationsChange = (annotations: AnnotationFilter[]) => {
    setFilter("annotations", annotations.length > 0 ? annotations : undefined);
  };

  const handleClearAll = () => {
    clearFilters();
    setNameInput("");
    setShowAllBadges(false);
  };

  const isSortDescending = filters.sort_direction !== "asc";

  const toggleSortDirection = () => {
    const newSortDirection = isSortDescending ? "asc" : "desc";
    setFilter("sort_direction", newSortDirection);
  };

  const hasAnnotations = filters.annotations && filters.annotations.length > 0;

  // Build list of all active filter badges
  const allBadges: Array<{
    key: FilterBadgeKey;
    label: string;
    onRemove: () => void;
  }> = [];

  if (filters.status) {
    allBadges.push({
      key: "status",
      label: getExecutionStatusLabel(filters.status),
      onRemove: () => setFilter("status", undefined),
    });
  }

  if (filters.pipeline_name) {
    allBadges.push({
      key: "pipeline_name",
      label: `Name: ${filters.pipeline_name}`,
      onRemove: () => {
        setFilter("pipeline_name", undefined);
        setNameInput("");
      },
    });
  }

  if (filters.created_by) {
    allBadges.push({
      key: "created_by",
      label: `Created by: ${filters.created_by}`,
      onRemove: () => setFilter("created_by", undefined),
    });
  }

  if (filters.created_after || filters.created_before) {
    const fromStr = filters.created_after
      ? format(new Date(filters.created_after), "MMM d")
      : "";
    const toStr = filters.created_before
      ? format(new Date(filters.created_before), "MMM d")
      : "";
    const separator = fromStr && toStr ? " – " : "";

    allBadges.push({
      key: "date_range",
      label: `${fromStr}${separator}${toStr}`,
      onRemove: () =>
        setFilters({ created_after: undefined, created_before: undefined }),
    });
  }

  filters.annotations?.forEach((annotation, index) => {
    allBadges.push({
      key: `annotation-${index}`,
      label: annotation.value
        ? `${annotation.key}: ${annotation.value}`
        : annotation.key,
      onRemove: () => {
        const newAnnotations = filters.annotations?.filter(
          (_, i) => i !== index,
        );
        setFilter(
          "annotations",
          newAnnotations && newAnnotations.length > 0
            ? newAnnotations
            : undefined,
        );
      },
    });
  });

  const visibleBadges = showAllBadges
    ? allBadges
    : allBadges.slice(0, MAX_VISIBLE_BADGES);
  const hiddenBadgeCount = allBadges.length - MAX_VISIBLE_BADGES;
  const hasHiddenBadges = hiddenBadgeCount > 0 && !showAllBadges;

  return (
    <Collapsible open={isAdvancedOpen} onOpenChange={setIsAdvancedOpen}>
      <BlockStack gap="3">
        {/* Row 1: Basic Filters */}
        <InlineStack gap="3" align="center">
          {/* Search Input - flexible width */}
          <div className="relative flex-1 min-w-0">
            <Icon
              name="Search"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              placeholder="Search by pipeline name..."
              value={nameInput}
              onChange={(e) => {
                setNameInput(e.target.value);
                setFilterDebounced("pipeline_name", e.target.value);
              }}
              className="pl-9 pr-8 w-full"
            />
            {nameInput && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setNameInput("");
                  setFilter("pipeline_name", undefined);
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 size-6 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <Icon name="X" size="sm" />
              </Button>
            )}
          </div>

          {/* Created By Filter */}
          <CreatedByFilter
            value={filters.created_by}
            onChange={(value) => setFilterDebounced("created_by", value)}
            onClear={() => setFilter("created_by", undefined)}
          />

          {/* Status Filter */}
          <Select
            value={filters.status ?? "all"}
            onValueChange={(value) =>
              setFilter("status", isValidStatus(value) ? value : undefined)
            }
          >
            <SelectTrigger className="w-44 shrink-0">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {STATUS_OPTIONS.map((status) => (
                <SelectItem key={status} value={status}>
                  {getExecutionStatusLabel(status)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Date Range */}
          <div className="shrink-0">
            <DatePickerWithRange
              value={dateRange}
              onChange={handleDateRangeChange}
              placeholder="Date range"
            />
          </div>

          {/* Sort Controls */}
          <InlineStack gap="1" align="center" className="shrink-0">
            <Select
              value={filters.sort_field ?? "created_at"}
              onValueChange={(value) =>
                setFilter(
                  "sort_field",
                  isValidSortField(value) ? value : undefined,
                )
              }
            >
              <SelectTrigger className="w-24">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                {SORT_FIELD_OPTIONS.map((field) => (
                  <SelectItem key={field.value} value={field.value}>
                    {field.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="ghost" size="icon" onClick={toggleSortDirection}>
              {isSortDescending ? (
                <Icon name="ArrowDownAZ" />
              ) : (
                <Icon name="ArrowUpAZ" />
              )}
            </Button>
          </InlineStack>

          {/* Advanced Toggle */}
          <CollapsibleTrigger asChild>
            <Button
              variant={hasAnnotations ? "secondary" : "outline"}
              size="sm"
              className="shrink-0"
            >
              Advanced
              {hasAnnotations && (
                <Badge variant="secondary" className="ml-1.5 h-5 min-w-5 px-1">
                  {filters.annotations?.length}
                </Badge>
              )}
              {isAdvancedOpen ? (
                <Icon name="ChevronUp" className="ml-1" />
              ) : (
                <Icon name="ChevronDown" className="ml-1" />
              )}
            </Button>
          </CollapsibleTrigger>
        </InlineStack>

        {/* Row 2: Advanced Filters (Collapsible) */}
        <CollapsibleContent>
          <div className="rounded-md border bg-muted/30 px-4 py-3">
            <AnnotationFilterInput
              filters={filters.annotations ?? []}
              onChange={handleAnnotationsChange}
            />
          </div>
        </CollapsibleContent>

        {/* Row 3: Active Filters & Count */}
        {(hasActiveFilters || totalCount !== undefined) && (
          <InlineStack gap="2" align="center" blockAlign="center">
            {totalCount !== undefined && (
              <Text size="sm" tone="subdued">
                Showing {filteredCount ?? totalCount} of {totalCount} runs
              </Text>
            )}

            <div className="flex-1" />

            {hasActiveFilters && (
              <InlineStack gap="2" align="center">
                {visibleBadges.map((badge) => (
                  <Badge key={badge.key} variant="outline">
                    {badge.label}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={badge.onRemove}
                      className="ml-1 size-4 hover:text-destructive hover:bg-transparent"
                      aria-label={`Remove ${badge.label} filter`}
                    >
                      <Icon name="X" size="xs" />
                    </Button>
                  </Badge>
                ))}

                {hasHiddenBadges && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAllBadges(true)}
                    className="h-6 px-2 text-xs"
                  >
                    +{hiddenBadgeCount} more
                  </Button>
                )}

                {showAllBadges && allBadges.length > MAX_VISIBLE_BADGES && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAllBadges(false)}
                    className="h-6 px-2 text-xs"
                  >
                    Show less
                  </Button>
                )}

                <Button variant="ghost" size="sm" onClick={handleClearAll}>
                  Clear all ({activeFilterCount})
                </Button>
              </InlineStack>
            )}
          </InlineStack>
        )}
      </BlockStack>
    </Collapsible>
  );
}
