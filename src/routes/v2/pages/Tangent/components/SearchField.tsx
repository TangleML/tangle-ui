import { type RefObject, useRef } from "react";

import { Icon } from "@/components/ui/icon";
import { tracking } from "@/utils/tracking";

/** A quiet search row: Escape or the clear button empties it. */
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
      <input
        ref={inputRef}
        type="search"
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
        className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:appearance-none"
        {...tracking(`${trackingPrefix}.search`)}
      />
      {value !== "" && (
        <button
          type="button"
          aria-label="Clear search"
          title="Clear search"
          onClick={clear}
          className="grid size-5 shrink-0 cursor-pointer place-items-center rounded-sm outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
          {...tracking(`${trackingPrefix}.clear_search`)}
        >
          <Icon name="X" size="xs" />
        </button>
      )}
    </div>
  );
}
