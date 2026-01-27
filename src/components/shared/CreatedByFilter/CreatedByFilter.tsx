import type { KeyboardEvent } from "react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InlineStack } from "@/components/ui/layout";
import { Switch } from "@/components/ui/switch";
import { DEFAULT_CREATED_BY_ME_FILTER_VALUE } from "@/utils/constants";

interface CreatedByFilterProps {
  /** Current filter value. undefined means no filter, "me" means current user. */
  value: string | undefined;
  /** Called when the filter value changes. undefined clears the filter. */
  onChange: (value: string | undefined) => void;
}

/**
 * Filter component for filtering by creator/initiator.
 * Provides a toggle for "Created by me" and an input for searching by specific user.
 */
export function CreatedByFilter({ value, onChange }: CreatedByFilterProps) {
  const [searchUser, setSearchUser] = useState(value ?? "");

  const isFilterActive = value !== undefined;
  const toggleText = value ? `Created by ${value}` : "Created by me";

  const handleToggleChange = (checked: boolean) => {
    if (checked) {
      // Enable filter - if no specific user set, default to "me"
      if (!value) {
        onChange(DEFAULT_CREATED_BY_ME_FILTER_VALUE);
        setSearchUser("");
      }
    } else {
      // Disable filter
      onChange(undefined);
    }
  };

  const handleUserSearch = () => {
    const trimmedUser = searchUser.trim();
    if (trimmedUser) {
      onChange(trimmedUser);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && searchUser.trim()) {
      e.preventDefault();
      handleUserSearch();
    }
  };

  return (
    <InlineStack gap="4" blockAlign="center">
      <InlineStack gap="2" blockAlign="center">
        <Switch
          id="created-by-filter"
          checked={isFilterActive}
          onCheckedChange={handleToggleChange}
        />
        <Label htmlFor="created-by-filter">{toggleText}</Label>
      </InlineStack>
      <InlineStack gap="1" blockAlign="center" wrap="nowrap">
        <Input
          placeholder="Search by user"
          value={searchUser}
          onChange={(e) => setSearchUser(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-40"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={handleUserSearch}
          disabled={!searchUser.trim()}
        >
          Search
        </Button>
      </InlineStack>
    </InlineStack>
  );
}
