import type { ChangeEvent } from "react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";

interface CreatedByFilterProps {
  /** Current filter value from URL. undefined means no filter. */
  value: string | undefined;
  /** Called when input value changes (parent handles debouncing). */
  onChange: (value: string | undefined) => void;
  /** Called when user clicks the clear button (for immediate clearing). */
  onClear: () => void;
  /** Pre-fills the input on mount and triggers onChange if no URL value is set. */
  defaultValue?: string;
}

/**
 * Text input filter for filtering pipeline runs by creator/initiator.
 */
export function CreatedByFilter({
  value,
  onChange,
  onClear,
  defaultValue,
}: CreatedByFilterProps) {
  const [inputValue, setInputValue] = useState(value ?? defaultValue ?? "");

  // Sync internal state when value changes externally (e.g., URL navigation, badge removal)
  useEffect(() => {
    setInputValue(value ?? "");
  }, [value]);

  // Apply defaultValue on mount if no URL value is already set
  useEffect(() => {
    if (defaultValue && value === undefined) {
      onChange(defaultValue);
    }
  }, []);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    onChange(newValue || undefined);
  };

  const handleClear = () => {
    setInputValue("");
    onClear();
  };

  const handleSetMe = () => {
    setInputValue("me");
    onChange("me");
  };

  return (
    <div className="relative">
      <Icon
        name="User"
        className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        placeholder="Search by user..."
        value={inputValue}
        onChange={handleChange}
        className="pl-9 pr-10 w-46"
      />
      {inputValue ? (
        <Button
          variant="ghost"
          size="icon"
          onClick={handleClear}
          className="absolute right-2 top-1/2 -translate-y-1/2 size-6 text-muted-foreground hover:text-foreground"
          aria-label="Clear user filter"
        >
          <Icon name="X" size="sm" />
        </Button>
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={handleSetMe}
          className="absolute right-0 top-1/2 -translate-y-1/2 h-full px-1.5 text-xs rounded-l-none bg-accent/80 hover:bg-accent"
        >
          Me
        </Button>
      )}
    </div>
  );
}
