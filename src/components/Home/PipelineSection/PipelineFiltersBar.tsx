import { format } from "date-fns";
import type { ReactNode } from "react";
import { useState } from "react";

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

import type {
  FilterBarProps,
  PipelineSortField,
} from "./usePipelineFilters";

const SORT_FIELD_OPTIONS: { value: PipelineSortField; label: string }[] = [
  { value: "modified_at", label: "Date" },
  { value: "name", label: "Name" },
];

function isValidSortField(value: string): value is PipelineSortField {
  return SORT_FIELD_OPTIONS.some((opt) => opt.value === value);
}

interface PipelineFiltersBarProps extends FilterBarProps {
  actions?: ReactNode;
}

export function PipelineFiltersBar({
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
  totalCount,
  filteredCount,
  actions,
}: PipelineFiltersBarProps) {
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

  const isSortDescending = sortDirection === "desc";

  const handleSortFieldChange = (value: string) => {
    if (isValidSortField(value)) setSortField(value);
  };

  const toggleSortDirection = () => {
    setSortDirection(isSortDescending ? "asc" : "desc");
  };

  const allBadges: Array<{
    key: string;
    label: string;
    onRemove: () => void;
  }> = [];

  if (searchQuery) {
    allBadges.push({
      key: "search",
      label: `Search: ${searchQuery}`,
      onRemove: () => setSearchQuery(""),
    });
  }

  if (dateRange?.from || dateRange?.to) {
    const fromStr = dateRange.from ? format(dateRange.from, "MMM d") : "";
    const toStr = dateRange.to ? format(dateRange.to, "MMM d") : "";
    const separator = fromStr && toStr ? " – " : "";
    allBadges.push({
      key: "date_range",
      label: `${fromStr}${separator}${toStr}`,
      onRemove: () => setDateRange(undefined),
    });
  }

  if (componentQuery) {
    allBadges.push({
      key: "component",
      label: `Component: ${componentQuery}`,
      onRemove: () => setComponentQuery(""),
    });
  }

  return (
    <Collapsible open={isAdvancedOpen} onOpenChange={setIsAdvancedOpen}>
      <BlockStack gap="3">
        {/* Row 1: Basic Filters */}
        <InlineStack gap="3" align="center">
          {/* Search */}
          <div className="relative flex-1 min-w-0">
            <Icon
              name="Search"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              placeholder="Name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-8 w-full"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 size-6 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <Icon name="X" size="sm" />
              </Button>
            )}
          </div>

          {/* Date Range */}
          <div className="shrink-0">
            <DatePickerWithRange
              value={dateRange}
              onChange={setDateRange}
              placeholder="Last edited range"
            />
          </div>

          {/* Sort Controls */}
          <InlineStack gap="1" align="center" className="shrink-0">
            <Select value={sortField} onValueChange={handleSortFieldChange}>
              <SelectTrigger className="w-24">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                {SORT_FIELD_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
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
              variant={componentQuery ? "secondary" : "outline"}
              size="sm"
              className="shrink-0"
            >
              Advanced
              {componentQuery && (
                <Badge variant="secondary" className="ml-1.5 h-5 min-w-5 px-1">
                  1
                </Badge>
              )}
              {isAdvancedOpen ? (
                <Icon name="ChevronUp" className="ml-1" />
              ) : (
                <Icon name="ChevronDown" className="ml-1" />
              )}
            </Button>
          </CollapsibleTrigger>

          {actions}
        </InlineStack>

        {/* Row 2: Advanced (Collapsible) */}
        <CollapsibleContent>
          <div className="rounded-md border bg-muted/30 px-4 py-3">
            <BlockStack gap="2">
              <Text size="sm" weight="semibold">
                Contains component
              </Text>
              <div className="relative">
                <Input
                  placeholder="Component name or URL..."
                  value={componentQuery}
                  onChange={(e) => setComponentQuery(e.target.value)}
                  className="pr-8 max-w-md"
                />
                {componentQuery && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setComponentQuery("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 size-6 text-muted-foreground hover:text-foreground"
                    aria-label="Clear component filter"
                  >
                    <Icon name="X" size="sm" />
                  </Button>
                )}
              </div>
              <Text size="xs" tone="subdued">
                Shows only pipelines that use a specific component
              </Text>
            </BlockStack>
          </div>
        </CollapsibleContent>

        {/* Row 3: Count + Active filter badges */}
        {(hasActiveFilters || totalCount > 0) && (
          <InlineStack gap="2" align="center" blockAlign="center">
            <Text size="sm" tone="subdued">
              Showing {filteredCount} of {totalCount} pipelines
            </Text>

            <div className="flex-1" />

            {hasActiveFilters && (
              <InlineStack gap="2" align="center">
                {allBadges.map((badge) => (
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

                <Button variant="ghost" size="sm" onClick={clearFilters}>
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
