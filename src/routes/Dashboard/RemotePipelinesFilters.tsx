import { addDays, startOfDay } from "date-fns";
import { useEffect, useId, useState } from "react";
import type { DateRange } from "react-day-picker";

import { CreatedByFilter } from "@/components/shared/CreatedByFilter/CreatedByFilter";
import { Button } from "@/components/ui/button";
import { DatePickerWithRange } from "@/components/ui/date-picker";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { remotePipelineFiltersToQuery } from "@/services/remotePipelinesService";

interface RemotePipelinesFiltersProps {
  onSearch: (filterQuery: string | undefined) => void;
}

export function RemotePipelinesFilters({
  onSearch,
}: RemotePipelinesFiltersProps) {
  const [name, setName] = useState("");
  const [id, setId] = useState("");
  const [user, setUser] = useState<string>();
  const [createdAt, setCreatedAt] = useState<DateRange>();
  const [updatedAt, setUpdatedAt] = useState<DateRange>();
  const hasFilters = name || id || user || createdAt?.from || updatedAt?.from;
  const idErrorId = useId();
  const invalidId = Boolean(
    id.trim() &&
    !/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(
      id.trim(),
    ),
  );
  const filterQuery = remotePipelineFiltersToQuery({
    name: name.trim(),
    id: id.trim(),
    user: user?.trim(),
    createdAfter: createdAt?.from && startOfDay(createdAt.from).toISOString(),
    createdBefore:
      createdAt?.to && startOfDay(addDays(createdAt.to, 1)).toISOString(),
    updatedAfter: updatedAt?.from && startOfDay(updatedAt.from).toISOString(),
    updatedBefore:
      updatedAt?.to && startOfDay(addDays(updatedAt.to, 1)).toISOString(),
  });

  useEffect(() => {
    if (invalidId) return;
    if (!filterQuery) {
      onSearch(undefined);
      return;
    }
    const timeout = window.setTimeout(() => onSearch(filterQuery), 200);
    return () => window.clearTimeout(timeout);
  }, [filterQuery, invalidId, onSearch]);

  function clearFilters() {
    setName("");
    setId("");
    setUser(undefined);
    setCreatedAt(undefined);
    setUpdatedAt(undefined);
  }

  return (
    <search aria-label="Remote pipeline filters" className="w-full">
      <InlineStack gap="2">
        <div className="relative w-44">
          <Icon
            name="Search"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            aria-label="Search by name"
            placeholder="Search by name..."
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="pl-9"
          />
        </div>
        <Input
          aria-label="Search by ID"
          aria-invalid={invalidId}
          aria-describedby={invalidId ? idErrorId : undefined}
          placeholder="Search by ID..."
          value={id}
          onChange={(event) => setId(event.target.value)}
          className="w-40"
        />
        <CreatedByFilter
          value={user}
          onChange={setUser}
          onClear={() => setUser(undefined)}
        />
        <fieldset className="min-w-0" title="Created at">
          <legend className="sr-only">Created at</legend>
          <DatePickerWithRange
            value={createdAt}
            onChange={setCreatedAt}
            placeholder="Created at"
          />
        </fieldset>
        <fieldset className="min-w-0" title="Updated at">
          <legend className="sr-only">Updated at</legend>
          <DatePickerWithRange
            value={updatedAt}
            onChange={setUpdatedAt}
            placeholder="Updated at"
          />
        </fieldset>
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            aria-label="Clear all filters"
          >
            <Icon name="X" size="sm" />
            Clear
          </Button>
        )}
      </InlineStack>
      {invalidId && (
        <Text id={idErrorId} size="sm" tone="critical">
          Enter a complete pipeline ID (UUID) to search.
        </Text>
      )}
    </search>
  );
}
