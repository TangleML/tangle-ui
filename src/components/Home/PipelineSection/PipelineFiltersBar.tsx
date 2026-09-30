import { format } from "date-fns";
import type { ReactNode } from "react";
import { useState } from "react";

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
import type {
  PipelineAnnotationFilter,
  RemotePipelineSortField,
} from "@/types/pipelineSearch";

import type {
  FilterBarProps,
  PipelineFilterControls,
} from "./usePipelineFilters";

interface RemoteFilterBarProps extends PipelineFilterControls {
  userId: string;
  setUserId: (value: string) => void;
  annotations: PipelineAnnotationFilter[];
  setAnnotations: (value: PipelineAnnotationFilter[]) => void;
  sortField: RemotePipelineSortField;
  setSortField: (value: RemotePipelineSortField) => void;
  resultCount: number | undefined;
  hasMoreResults: boolean;
}

interface PipelineFiltersBarProps {
  filters: FilterBarProps | RemoteFilterBarProps;
  actions?: ReactNode;
}

export function PipelineFiltersBar({
  filters,
  actions,
}: PipelineFiltersBarProps) {
  const {
    searchQuery,
    setSearchQuery,
    dateRange,
    setDateRange,
    sortField,
    sortDirection,
    setSortDirection,
    clearFilters,
    totalCount,
  } = filters;
  const remote = "userId" in filters ? filters : undefined;
  const local = "componentQuery" in filters ? filters : undefined;
  const storageLabel = remote ? "remote" : "local";
  const filteredCount = remote ? remote.resultCount : local?.filteredCount;
  const advancedFilterCount = remote
    ? remote.annotations.length
    : Number(!!local?.componentQuery);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

  const isSortDescending = sortDirection === "desc";

  const handleSortFieldChange = (value: string) => {
    if (value === "name") filters.setSortField(value);
    else if (value === "modified_at") {
      if (remote) remote.setSortField("updated_at");
      else local?.setSortField("modified_at");
    }
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
      label: `${remote ? "Edited: " : ""}${fromStr}${separator}${toStr}`,
      onRemove: () => setDateRange(undefined),
    });
  }

  if (local?.componentQuery) {
    allBadges.push({
      key: "component",
      label: `Component: ${local.componentQuery}`,
      onRemove: () => local.setComponentQuery(""),
    });
  }

  if (remote && remote.userId !== "me") {
    allBadges.push({
      key: "owner",
      label: remote.userId ? `Owner: ${remote.userId}` : "All owners",
      onRemove: () => remote.setUserId("me"),
    });
  }
  const activeFilterCount =
    allBadges.length + (remote?.annotations.length ?? 0);
  const hasActiveFilters = activeFilterCount > 0;

  return (
    <Collapsible open={isAdvancedOpen} onOpenChange={setIsAdvancedOpen}>
      <BlockStack gap="3">
        <InlineStack gap="3" align="center" wrap="wrap" className="w-full">
          <div className="relative flex-1 min-w-60">
            <Icon
              name="Search"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              placeholder={remote ? "Search by name or path..." : "Search..."}
              aria-label={`Search ${storageLabel} pipelines`}
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
                aria-label={
                  remote ? "Clear remote pipeline search" : "Clear search"
                }
              >
                <Icon name="X" size="sm" />
              </Button>
            )}
          </div>

          {remote && (
            <CreatedByFilter
              value={remote.userId}
              onChange={(value) => remote.setUserId(value ?? "")}
              onClear={() => remote.setUserId("")}
              label="Filter remote pipelines by owner"
              placeholder="All owners"
              clearLabel="Clear owner filter"
            />
          )}

          <div className="shrink-0">
            <DatePickerWithRange
              value={dateRange}
              onChange={setDateRange}
              placeholder="Last edited range"
            />
          </div>

          <InlineStack gap="1" align="center" className="shrink-0">
            <Select
              value={sortField === "name" ? "name" : "modified_at"}
              onValueChange={handleSortFieldChange}
            >
              <SelectTrigger
                className="w-32"
                aria-label={`Sort ${storageLabel} pipelines by`}
              >
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="modified_at">
                  {remote ? "Last edited" : "Date"}
                </SelectItem>
                <SelectItem value="name">Name</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSortDirection}
              aria-label={
                isSortDescending ? "Sort ascending" : "Sort descending"
              }
            >
              {isSortDescending ? (
                <Icon name="ArrowDownAZ" />
              ) : (
                <Icon name="ArrowUpAZ" />
              )}
            </Button>
          </InlineStack>

          <CollapsibleTrigger asChild>
            <Button
              variant={advancedFilterCount > 0 ? "secondary" : "outline"}
              size="sm"
              className="shrink-0"
            >
              Advanced{" "}
              {advancedFilterCount > 0 && (
                <Badge variant="secondary" className="ml-1.5 h-5 min-w-5 px-1">
                  {advancedFilterCount}
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

        <CollapsibleContent>
          <BlockStack
            gap="2"
            className="rounded-md border bg-muted/30 px-4 py-3"
          >
            {remote && (
              <AnnotationFilterInput
                filters={remote.annotations}
                onChange={remote.setAnnotations}
              />
            )}
            {local && (
              <>
                <Text size="sm" weight="semibold">
                  Contains component
                </Text>
                <InlineStack align="start" className="relative w-xs">
                  <Input
                    placeholder="Component name..."
                    value={local.componentQuery}
                    onChange={(e) => local.setComponentQuery(e.target.value)}
                    className="pr-8 w-xs"
                  />
                  {local.componentQuery && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => local.setComponentQuery("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 size-6 text-muted-foreground hover:text-foreground"
                      aria-label="Clear component filter"
                    >
                      <Icon name="X" size="sm" />
                    </Button>
                  )}
                </InlineStack>
              </>
            )}
          </BlockStack>
        </CollapsibleContent>

        {(hasActiveFilters ||
          (remote ? filteredCount !== undefined : totalCount > 0)) && (
          <InlineStack
            gap="2"
            align="center"
            blockAlign="center"
            wrap="wrap"
            className="w-full"
          >
            {filteredCount !== undefined && (
              <Text size="sm" tone="subdued">
                Showing {filteredCount} of {totalCount}
                {remote?.hasMoreResults ? "+" : ""} pipelines
              </Text>
            )}

            <div className="flex-1" />

            {hasActiveFilters && (
              <InlineStack gap="2" align="center" wrap="wrap">
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
