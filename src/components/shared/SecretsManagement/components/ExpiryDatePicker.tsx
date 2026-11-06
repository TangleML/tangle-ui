import { startOfToday } from "date-fns";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Icon } from "@/components/ui/icon";
import { InlineStack } from "@/components/ui/layout";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Text } from "@/components/ui/typography";
import { formatDate } from "@/utils/date";

export const EXPIRY_FORMAT: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  year: "numeric",
};

interface ExpiryDatePickerProps {
  id: string;
  value: Date | undefined;
  onChange: (date: Date | undefined) => void;
  describedBy?: string;
}

export function ExpiryDatePicker({
  id,
  value,
  onChange,
  describedBy,
}: ExpiryDatePickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <InlineStack gap="1" wrap="nowrap" className="w-full">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            aria-describedby={describedBy}
            className="flex-1 justify-start gap-2 font-normal"
          >
            <Icon name="Calendar" size="sm" />
            {value ? (
              formatDate(value, EXPIRY_FORMAT)
            ) : (
              <Text as="span" tone="subdued">
                No expiry
              </Text>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={value}
            defaultMonth={value}
            disabled={(date) => date < startOfToday()}
            onSelect={(date) => {
              onChange(date);
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
      {value && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Clear expiry"
          onClick={() => onChange(undefined)}
        >
          <Icon name="X" size="sm" />
        </Button>
      )}
    </InlineStack>
  );
}
