import { type ReactNode, useEffect, useState } from "react";

import { CreatedByFilter } from "@/components/shared/CreatedByFilter/CreatedByFilter";
import { InfoBox } from "@/components/shared/InfoBox";
import { Button } from "@/components/ui/button";
import { DatePickerWithRange } from "@/components/ui/date-picker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/typography";
import { useCompareRunList } from "@/routes/v2/pages/CompareView/hooks/useCompareRunList";
import type { PipelineRunFilters } from "@/types/pipelineRunFilters";
import {
  parseUTCAsLocalDate,
  toEndOfDayUTC,
  toStartOfDayUTC,
} from "@/utils/date";
import { filtersToFilterQuery } from "@/utils/pipelineRunFilterUtils";

import { RunPickerRow } from "./RunPickerRow";

const SEARCH_DEBOUNCE_MS = 250;

interface RunPickerDialogProps {
  side: "a" | "b";
  excludeRunId?: string;
  onSelect: (runId: string) => void;
  trigger: ReactNode;
}

export function RunPickerDialog({
  side,
  excludeRunId,
  onSelect,
  trigger,
}: RunPickerDialogProps) {
  const [open, setOpen] = useState(false);
  const [filters, setFilters] = useState<PipelineRunFilters>({});
  const [nameInput, setNameInput] = useState("");

  useEffect(() => {
    const timeout = setTimeout(() => {
      setFilters((prev) => ({
        ...prev,
        pipeline_name: nameInput.trim() || undefined,
      }));
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [nameInput]);

  const filterQuery = filtersToFilterQuery(filters);
  const { data, isLoading, error } = useCompareRunList({ filterQuery });

  const dateRange =
    filters.created_after || filters.created_before
      ? {
          from: filters.created_after
            ? parseUTCAsLocalDate(filters.created_after)
            : undefined,
          to: filters.created_before
            ? parseUTCAsLocalDate(filters.created_before)
            : undefined,
        }
      : undefined;

  const runs = (data?.pipeline_runs ?? []).filter(
    (run) => `${run.id}` !== excludeRunId,
  );

  const handleSelect = (runId: string) => {
    onSelect(runId);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="flex max-h-[80vh] w-[90vw] flex-col sm:max-w-280">
        <DialogHeader>
          <DialogTitle>Select run {side === "a" ? "A" : "B"}</DialogTitle>
          <DialogDescription>
            Choose a run to add to the comparison.
          </DialogDescription>
        </DialogHeader>

        <InlineStack gap="2" blockAlign="center" wrap="wrap" className="w-full">
          <div className="relative min-w-60 flex-1">
            <Icon
              name="Search"
              size="sm"
              className="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              placeholder="Search by pipeline name..."
              value={nameInput}
              onChange={(event) => setNameInput(event.target.value)}
              className="w-full pr-8 pl-9"
            />
            {nameInput && (
              <Button
                variant="ghost"
                size="icon"
                aria-label="Clear search"
                onClick={() => setNameInput("")}
                className="absolute top-1/2 right-2 size-6 -translate-y-1/2"
              >
                <Icon name="X" size="sm" />
              </Button>
            )}
          </div>
          <CreatedByFilter
            value={filters.created_by}
            onChange={(value) =>
              setFilters((prev) => ({ ...prev, created_by: value }))
            }
            onClear={() =>
              setFilters((prev) => ({ ...prev, created_by: undefined }))
            }
          />
          <DatePickerWithRange
            value={dateRange}
            placeholder="Date range (UTC)"
            onChange={(range) =>
              setFilters((prev) => ({
                ...prev,
                created_after: range?.from
                  ? toStartOfDayUTC(range.from)
                  : undefined,
                created_before: range?.to ? toEndOfDayUTC(range.to) : undefined,
              }))
            }
          />
        </InlineStack>

        <BlockStack gap="1" className="min-h-0 flex-1 overflow-auto">
          {isLoading && (
            <InlineStack gap="2" blockAlign="center">
              <Spinner /> <Text>Loading runs…</Text>
            </InlineStack>
          )}
          {error && (
            <InfoBox title="Error loading runs" variant="error" width="full">
              {error.message}
            </InfoBox>
          )}
          {data && runs.length === 0 && (
            <Text tone="subdued" size="sm">
              No runs match your filters.
            </Text>
          )}
          {runs.map((run) => (
            <RunPickerRow key={run.id} run={run} onSelect={handleSelect} />
          ))}
        </BlockStack>
      </DialogContent>
    </Dialog>
  );
}
