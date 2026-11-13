import { type RefObject, useRef } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { tracking } from "@/utils/tracking";

/**
 * A quiet search row, borderless until it's hovered or focused, unlike the
 * bordered `InputGroup`. Escape or the clear button empties it; an empty
 * field leaves Escape to whatever holds it, such as a popover.
 */
export function SearchField({
  value,
  onChange,
  label,
  trackingPrefix,
  inputRef: givenRef,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  trackingPrefix: string;
  inputRef?: RefObject<HTMLInputElement | null>;
}) {
  const ownRef = useRef<HTMLInputElement>(null);
  const inputRef = givenRef ?? ownRef;

  function clear() {
    onChange("");
    inputRef.current?.focus();
  }

  return (
    <div
      role="search"
      className="flex h-8 items-center gap-2 rounded-md px-2 text-muted-foreground transition-colors focus-within:bg-foreground/5 focus-within:ring-1 focus-within:ring-ring/50 hover:bg-foreground/5 motion-reduce:transition-none"
    >
      <Icon name="Search" size="sm" className="shrink-0" />
      <Input
        ref={inputRef}
        type="search"
        variant="noBorder"
        value={value}
        placeholder="Search"
        aria-label={label}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Escape" || value === "") return;
          event.preventDefault();
          event.stopPropagation();
          onChange("");
        }}
        className="h-auto p-0 text-sm text-foreground [&::-webkit-search-cancel-button]:appearance-none"
        {...tracking(`${trackingPrefix}.search`)}
      />
      {value !== "" && (
        <Button
          variant="subtle"
          size="min"
          aria-label="Clear search"
          title="Clear search"
          onClick={clear}
          {...tracking(`${trackingPrefix}.clear_search`)}
        >
          <Icon name="X" size="xs" />
        </Button>
      )}
    </div>
  );
}
