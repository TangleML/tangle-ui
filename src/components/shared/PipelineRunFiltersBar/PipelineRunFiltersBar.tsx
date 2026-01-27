import { useState } from "react";
import type { DateRange } from "react-day-picker";

import { AnnotationFilterInput } from "@/components/shared/AnnotationFilterInput/AnnotationFilterInput";
import { StatusFilterSelect } from "@/components/shared/StatusFilterSelect/StatusFilterSelect";
import { Button } from "@/components/ui/button";
import { DatePickerWithRange } from "@/components/ui/date-picker";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { useRunSearchParams } from "@/hooks/useRunSearchParams";
import type { AnnotationFilter } from "@/types/pipelineRunFilters";

export function PipelineRunFiltersBar() {
  const { filters, setFilter, setFilters, setFilterDebounced } =
    useRunSearchParams();

  const [nameInput, setNameInput] = useState(filters.pipeline_name ?? "");

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

  return (
    <BlockStack gap="3">
      <InlineStack gap="3" align="center">
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

        <div className="shrink-0">
          <StatusFilterSelect
            value={filters.status}
            onChange={(value) => setFilter("status", value)}
          />
        </div>

        <div className="shrink-0">
          <DatePickerWithRange
            value={dateRange}
            onChange={handleDateRangeChange}
            placeholder="Date range"
          />
        </div>
      </InlineStack>

      <AnnotationFilterInput
        filters={filters.annotations ?? []}
        onChange={handleAnnotationsChange}
      />
    </BlockStack>
  );
}
