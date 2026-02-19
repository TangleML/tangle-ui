import { useState } from "react";
import { HexColorPicker } from "react-colorful";

import { useDebouncedState } from "@/hooks/useDebouncedState";
import { cn } from "@/lib/utils";

import { Button } from "./button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "./collapsible";
import { Icon } from "./icon";
import { Input } from "./input";
import { BlockStack, InlineStack } from "./layout";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { Heading } from "./typography";

const PRESET_COLORS = [
  "#FFF9C4",
  "#C8E6C9",
  "#BBDEFB",
  "#D1C4E9",
  "#FFE0B2",
  "#EF9A9A",
  "#FFCCBC",
  "#D7CCC8",
  "#F5F5F5",
  "#CFD8DC",
  "#B0BEC5",
  "transparent",
];

interface ColorPickerProps {
  title?: string;
  color: string;
  debounceMs?: number;
  setColor: (color: string) => void;
  onClose?: () => void;
}

export const ColorPicker = ({
  color,
  title,
  debounceMs = 300,
  setColor,
  onClose,
}: ColorPickerProps) => {
  const [open, setOpen] = useState(false);
  const [localColor, setLocalColor] = useState(color);

  const { clearDebounce, updatePreviousState } = useDebouncedState(
    localColor,
    setColor,
    () => false,
    { debounceMs },
  );

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      onClose?.();
    }
  };

  const handlePresetClick = (preset: string) => {
    clearDebounce();
    setLocalColor(preset);
    setColor(preset);
    updatePreviousState(preset);
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger>
        <div
          className="aspect-square h-4 rounded-full border border-muted-foreground cursor-pointer"
          style={{ backgroundColor: color }}
        />
      </PopoverTrigger>
      <PopoverContent className="w-fit">
        <BlockStack gap="4" align="center">
          <Heading level={3}>{title ?? "Pick a color"}</Heading>
          <InlineStack gap="2" className="grid grid-cols-6 px-2">
            {PRESET_COLORS.map((preset) => (
              <div
                key={preset}
                className={cn(
                  "aspect-square w-6 rounded-sm border border-muted-foreground cursor-pointer relative overflow-hidden",
                  {
                    "ring-2 ring-offset-2 ring-black": preset === color,
                  },
                )}
                style={{ backgroundColor: preset }}
                onClick={() => handlePresetClick(preset)}
              >
                {preset === "transparent" && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="h-px w-full bg-red-500 rotate-45 origin-center" />
                  </div>
                )}
              </div>
            ))}
          </InlineStack>
          <div className="relative w-full">
            <Input
              value={localColor}
              onChange={(e) => setLocalColor(e.target.value)}
            />
            <Collapsible>
              <InlineStack blockAlign="center" gap="1">
                <CollapsibleTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="absolute right-2 top-0 hover:bg-transparent hover:text-black!"
                    style={{
                      color:
                        localColor === "transparent" ? "lightgray" : localColor,
                      filter: "brightness(0.8)",
                    }}
                  >
                    <Icon name="Palette" />
                    <span className="sr-only">Toggle</span>
                  </Button>
                </CollapsibleTrigger>
              </InlineStack>
              <CollapsibleContent className="mt-2">
                <HexColorPicker color={localColor} onChange={setLocalColor} />
              </CollapsibleContent>
            </Collapsible>
          </div>
        </BlockStack>
      </PopoverContent>
    </Popover>
  );
};
