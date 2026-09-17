import { Icon } from "@/components/ui/icon";
import { InlineStack } from "@/components/ui/layout";
import { cn } from "@/lib/utils";

import {
  PROJECT_COLORS,
  type ProjectColor,
  projectColorStyles,
} from "./projectColors";

interface ProjectColorPickerProps {
  value: ProjectColor | undefined;
  onChange: (color: ProjectColor | undefined) => void;
}

const SWATCH_CLASS =
  "flex size-6 cursor-pointer items-center justify-center rounded-full transition-transform hover:scale-110 focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none";

export function ProjectColorPicker({
  value,
  onChange,
}: ProjectColorPickerProps) {
  return (
    <InlineStack gap="2" blockAlign="center" wrap="wrap">
      <button
        type="button"
        onClick={() => onChange(undefined)}
        aria-label="No colour"
        aria-pressed={value === undefined}
        className={cn(
          SWATCH_CLASS,
          "border border-dashed border-muted-foreground text-muted-foreground",
        )}
      >
        {value === undefined && <Icon name="Check" size="sm" />}
      </button>
      {PROJECT_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          onClick={() => onChange(color)}
          aria-label={projectColorStyles[color].label}
          aria-pressed={value === color}
          className={cn(
            SWATCH_CLASS,
            projectColorStyles[color].accent,
            "text-white",
          )}
        >
          {value === color && <Icon name="Check" size="sm" />}
        </button>
      ))}
    </InlineStack>
  );
}
