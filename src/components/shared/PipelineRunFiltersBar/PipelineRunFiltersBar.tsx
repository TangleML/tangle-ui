import { format } from "date-fns";
import { useState } from "react";
import type { DateRange } from "react-day-picker";

import { CreatedByFilter } from "@/components/shared/CreatedByFilter/CreatedByFilter";
import { useFlagValue } from "@/components/shared/Settings/useFlags";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DatePickerWithRange } from "@/components/ui/date-picker";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { useRunSearchParams } from "@/hooks/useRunSearchParams";
import type { AnnotationFilter } from "@/types/pipelineRunFilters";
import {
  parseUTCAsLocalDate,
  toEndOfDayUTC,
  toStartOfDayUTC,
} from "@/utils/date";

const MAX_VISIBLE_BADGES = 4;

type FilterBadgeKey =
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
  const isCreatedByMeDefault = useFlagValue("created-by-me-default");
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
  const [showAllBadges, setShowAllBadges] = useState(false);

  // Annotation inline input state
  const [isAnnotationExpanded, setIsAnnotationExpanded] = useState(false);
  const [annotationKeyInput, setAnnotationKeyInput] = useState("");
  const [annotationValueInput, setAnnotationValueInput] = useState("");

  const createdAfter = filters.created_after
    ? parseUTCAsLocalDate(filters.created_after)
    : undefined;
  const createdBefore = filters.created_before
    ? parseUTCAsLocalDate(filters.created_before)
    : undefined;

  const dateRange: DateRange | undefined =
    createdAfter || createdBefore
      ? { from: createdAfter, to: createdBefore }
      : undefined;

  const handleDateRangeChange = (range: DateRange | undefined) => {
    setFilters({
      created_after: range?.from ? toStartOfDayUTC(range.from) : undefined,
      created_before: range?.to ? toEndOfDayUTC(range.to) : undefined,
    });
  };

  const handleAddAnnotation = () => {
    const trimmedKey = annotationKeyInput.trim();
    if (!trimmedKey) return;

    const newFilter: AnnotationFilter = {
      key: trimmedKey,
      value: annotationValueInput.trim() || undefined,
    };

    const current = filters.annotations ?? [];
    setFilter("annotations", [...current, newFilter]);
    setAnnotationKeyInput("");
    setAnnotationValueInput("");
    setIsAnnotationExpanded(false);
  };

  const handleCancelAnnotation = () => {
    setIsAnnotationExpanded(false);
    setAnnotationKeyInput("");
    setAnnotationValueInput("");
  };

  const handleClearAll = () => {
    clearFilters();
    setNameInput("");
    setShowAllBadges(false);
  };

  // Build list of all active filter badges
  const allBadges: Array<{
    key: FilterBadgeKey;
    label: string;
    onRemove: () => void;
  }> = [];

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
    const fromStr = createdAfter ? format(createdAfter, "MMM d") : "";
    const toStr = createdBefore ? format(createdBefore, "MMM d") : "";
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
    <BlockStack gap="3">
      {/* Row 1: All Filters */}
      <InlineStack gap="3" align="center" wrap="wrap">
        {/* Search Input - flexible width */}
        <div className="relative flex-1">
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
            className="pl-9 pr-8 w-fit min-w-60"
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
          defaultValue={
            isCreatedByMeDefault && !filters.created_by ? "me" : undefined
          }
        />

        {/* Date Range */}
        <div className="shrink-0">
          <DatePickerWithRange
            value={dateRange}
            onChange={handleDateRangeChange}
            placeholder="Date range (UTC)"
          />
        </div>

        {/* Annotation Filter button */}
        {!isAnnotationExpanded && (
          <Button
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={() => setIsAnnotationExpanded(true)}
          >
            <Icon name="Plus" size="xs" className="mr-1" />
            Annotation
          </Button>
        )}
      </InlineStack>

      {/* Annotation input row - rendered below to avoid overflow */}
      {isAnnotationExpanded && (
        <InlineStack gap="1" align="center">
          <Input
            placeholder="Key"
            value={annotationKeyInput}
            onChange={(e) => setAnnotationKeyInput(e.target.value)}
            onEnter={handleAddAnnotation}
            onEscape={handleCancelAnnotation}
            className="w-28 h-8 text-sm"
            autoFocus
          />
          <Input
            placeholder="Value (optional)"
            value={annotationValueInput}
            onChange={(e) => setAnnotationValueInput(e.target.value)}
            onEnter={handleAddAnnotation}
            onEscape={handleCancelAnnotation}
            className="w-36 h-8 text-sm"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={handleAddAnnotation}
            disabled={!annotationKeyInput.trim()}
          >
            Add
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCancelAnnotation}
            aria-label="Cancel"
          >
            <Icon name="X" size="xs" />
          </Button>
        </InlineStack>
      )}

      {/* Row 2: Active Filters & Count */}
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
  );
}
