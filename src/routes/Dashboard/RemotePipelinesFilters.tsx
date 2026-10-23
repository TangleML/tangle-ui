import { useLocation } from "@tanstack/react-router";
import { format, parseISO } from "date-fns";
import { useEffect, useId, useRef } from "react";

import { CreatedByFilter } from "@/components/shared/CreatedByFilter/CreatedByFilter";
import { Button } from "@/components/ui/button";
import { DatePickerWithRange } from "@/components/ui/date-picker";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { useDebouncedSearchValue } from "@/hooks/useDebouncedSearchValue";

import {
  hasRemotePipelineFilters,
  isInvalidPipelineId,
  type RemotePipelineSearchFilters,
} from "./pipelinesSearch";

interface RemotePipelinesFiltersProps {
  filters: RemotePipelineSearchFilters;
  onChange: (filters: RemotePipelineSearchFilters) => void;
  onPendingChange: (pending: boolean) => void;
}

export function RemotePipelinesFilters({
  filters,
  onChange,
  onPendingChange,
}: RemotePipelinesFiltersProps) {
  const { name, id, user, createdFrom, createdTo, updatedFrom, updatedTo } =
    filters;
  const navigationIndex = useLocation({
    select: (location) => location.state.__TSR_index,
  });
  const previousNavigationIndex = useRef(navigationIndex);
  const [nameInput, setNameInput, resetName] = useDebouncedSearchValue(
    (name) => onChange({ name: name || undefined }),
    undefined,
    name ?? "",
  );
  const [idInput, setIdInput, resetId] = useDebouncedSearchValue(
    (id) => onChange({ id: id || undefined }),
    undefined,
    id ?? "",
  );
  const [userInput, setUserInput, resetUser] = useDebouncedSearchValue(
    (user) => onChange({ user: user || undefined }),
    undefined,
    user ?? "",
  );
  const pending =
    nameInput !== (name ?? "") ||
    idInput !== (id ?? "") ||
    userInput !== (user ?? "");

  useEffect(() => {
    onPendingChange(pending);
  }, [onPendingChange, pending]);

  useEffect(() => {
    if (previousNavigationIndex.current === navigationIndex) return;
    previousNavigationIndex.current = navigationIndex;
    resetName(name ?? "");
    resetId(id ?? "");
    resetUser(user ?? "");
  }, [navigationIndex, name, id, user, resetName, resetId, resetUser]);

  const createdAt = createdFrom
    ? {
        from: parseISO(createdFrom),
        to: createdTo ? parseISO(createdTo) : undefined,
      }
    : undefined;
  const updatedAt = updatedFrom
    ? {
        from: parseISO(updatedFrom),
        to: updatedTo ? parseISO(updatedTo) : undefined,
      }
    : undefined;
  const idErrorId = useId();
  const invalidId = isInvalidPipelineId(idInput);

  function clearFilters() {
    resetName("");
    resetId("");
    resetUser("");
    onChange({
      name: undefined,
      id: undefined,
      user: undefined,
      createdFrom: undefined,
      createdTo: undefined,
      updatedFrom: undefined,
      updatedTo: undefined,
    });
  }

  return (
    <div role="search" aria-label="Remote pipeline filters" className="w-full">
      <InlineStack gap="2">
        <div className="relative w-44">
          <Icon
            name="Search"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            aria-label="Search by name"
            placeholder="Search by name..."
            value={nameInput}
            onChange={(event) => setNameInput(event.target.value)}
            className="pl-9"
          />
        </div>
        <Input
          aria-label="Search by ID"
          aria-invalid={invalidId}
          aria-describedby={invalidId ? idErrorId : undefined}
          placeholder="Search by ID..."
          value={idInput}
          onChange={(event) => setIdInput(event.target.value)}
          className="w-40"
        />
        <CreatedByFilter
          value={userInput || undefined}
          onChange={(user) => setUserInput(user ?? "")}
          onClear={() => {
            resetUser("");
            onChange({ user: undefined });
          }}
          onSetMe={() => {
            resetUser("me");
            onChange({ user: "me" });
          }}
        />
        <fieldset className="min-w-0" title="Created at">
          <legend className="sr-only">Created at</legend>
          <DatePickerWithRange
            value={createdAt}
            onChange={(range) =>
              onChange({
                createdFrom: range?.from && format(range.from, "yyyy-MM-dd"),
                createdTo: range?.to && format(range.to, "yyyy-MM-dd"),
              })
            }
            placeholder="Created at"
          />
        </fieldset>
        <fieldset className="min-w-0" title="Updated at">
          <legend className="sr-only">Updated at</legend>
          <DatePickerWithRange
            value={updatedAt}
            onChange={(range) =>
              onChange({
                updatedFrom: range?.from && format(range.from, "yyyy-MM-dd"),
                updatedTo: range?.to && format(range.to, "yyyy-MM-dd"),
              })
            }
            placeholder="Updated at"
          />
        </fieldset>
        {(hasRemotePipelineFilters(filters) || pending) && (
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
    </div>
  );
}
