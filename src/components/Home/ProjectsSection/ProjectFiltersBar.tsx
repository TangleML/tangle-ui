import { format } from "date-fns";
import type { DateRange } from "react-day-picker";

import { CreatedByFilter } from "@/components/shared/CreatedByFilter/CreatedByFilter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DatePickerWithRange } from "@/components/ui/date-picker";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";

import type { ProjectFilterBarProps } from "./useProjectFilters";

interface FilterBadge {
  key: string;
  label: string;
  onRemove: () => void;
}

function describeRange(dateRange: DateRange): string {
  const from = dateRange.from ? format(dateRange.from, "MMM d") : "";
  const to = dateRange.to ? format(dateRange.to, "MMM d") : "";
  const separator = from && to ? " – " : "";

  return `Created ${from}${separator}${to}`;
}

export function ProjectFiltersBar({
  filters,
}: {
  filters: ProjectFilterBarProps;
}) {
  const {
    searchQuery,
    setSearchQuery,
    author,
    setAuthor,
    dateRange,
    setDateRange,
    hasActiveFilters,
    activeFilterCount,
    clearFilters,
    totalCount,
    filteredCount,
  } = filters;

  const badges: FilterBadge[] = [];

  if (searchQuery.trim()) {
    badges.push({
      key: "name",
      label: `Name: ${searchQuery}`,
      onRemove: () => setSearchQuery(""),
    });
  }

  if (author?.trim()) {
    badges.push({
      key: "author",
      label: `Created by: ${author}`,
      onRemove: () => setAuthor(undefined),
    });
  }

  if (dateRange) {
    badges.push({
      key: "created",
      label: describeRange(dateRange),
      onRemove: () => setDateRange(undefined),
    });
  }

  return (
    <BlockStack gap="3">
      <InlineStack gap="3" align="start" blockAlign="center" wrap="wrap">
        <div className="relative">
          <Icon
            name="Search"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            placeholder="Search by project name..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="w-fit min-w-60 pl-9 pr-8"
            aria-label="Search by project name"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 size-6 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <Icon name="X" size="sm" />
            </Button>
          )}
        </div>

        <CreatedByFilter
          value={author}
          onChange={setAuthor}
          onClear={() => setAuthor(undefined)}
        />

        <div className="shrink-0">
          <DatePickerWithRange
            value={dateRange}
            onChange={setDateRange}
            placeholder="Created between"
          />
        </div>
      </InlineStack>

      <InlineStack
        gap="2"
        align="center"
        blockAlign="center"
        className="w-full"
      >
        <Text size="sm" tone="subdued">
          {hasActiveFilters
            ? `Showing ${filteredCount} of ${totalCount} projects`
            : `${totalCount} projects`}
        </Text>

        <div className="flex-1" />

        {hasActiveFilters && (
          <InlineStack gap="2" align="center">
            {badges.map((badge) => (
              <Badge key={badge.key} variant="outline">
                {badge.label}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={badge.onRemove}
                  className="ml-1 size-4 hover:bg-transparent hover:text-destructive"
                  aria-label={`Remove ${badge.label} filter`}
                >
                  <Icon name="X" size="xs" />
                </Button>
              </Badge>
            ))}
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              {`Clear all (${activeFilterCount})`}
            </Button>
          </InlineStack>
        )}
      </InlineStack>
    </BlockStack>
  );
}
