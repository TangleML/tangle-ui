import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";

interface TextSizeSelectorProps {
  value: number;
  onChange: (size: number) => void;
  className?: string;
}

const TEXT_SIZE_MAX = 64;
const TEXT_SIZE_MIN = 6;

export const TextSizeSelector = ({
  value,
  onChange,
  className,
}: TextSizeSelectorProps) => {
  return (
    <Popover>
      <PopoverTrigger>
        <div
          className={cn(
            "cursor-pointer border border-muted rounded-sm p-1 bg-background h-fit aspect-square hover:bg-secondary flex items-center justify-center",
            className,
          )}
        >
          <Icon name="Type" />
        </div>
      </PopoverTrigger>

      <PopoverContent className="p-3">
        <BlockStack gap="2">
          <InlineStack align="space-between" blockAlign="center" fill>
            <Text size="xs" tone="subdued">
              Font Size
            </Text>
            <Text size="xs" font="mono">
              {value}px
            </Text>
          </InlineStack>
          <Slider
            value={[value]}
            onValueChange={([newValue]) => onChange(newValue)}
            min={TEXT_SIZE_MIN}
            max={TEXT_SIZE_MAX}
            step={1}
          />
        </BlockStack>
      </PopoverContent>
    </Popover>
  );
};
