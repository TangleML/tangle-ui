import { useState } from "react";
import { HexColorPicker } from "react-colorful";

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
  setColor: (color: string) => void;
  onClose?: () => void;
}

export const ColorPicker = ({
  color,
  title,
  setColor,
  onClose,
}: ColorPickerProps) => {
  const [open, setOpen] = useState(false);

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      onClose?.();
    }
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
                onClick={() => setColor(preset)}
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
            <Input value={color} onChange={(e) => setColor(e.target.value)} />
            <Collapsible>
              <InlineStack blockAlign="center" gap="1">
                <CollapsibleTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="absolute right-2 top-0 hover:bg-transparent hover:text-black!"
                    style={{ color }}
                  >
                    <Icon name="Palette" />
                    <span className="sr-only">Toggle</span>
                  </Button>
                </CollapsibleTrigger>
              </InlineStack>
              <CollapsibleContent className="mt-2">
                <HexColorPicker color={color} onChange={setColor} />
              </CollapsibleContent>
            </Collapsible>
          </div>
        </BlockStack>
      </PopoverContent>
    </Popover>
  );
};
