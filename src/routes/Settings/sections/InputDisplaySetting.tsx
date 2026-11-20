import { Button } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icon";
import { BlockStack } from "@/components/ui/layout";
import { Paragraph } from "@/components/ui/typography";
import {
  type InputDisplayMode,
  setInputDisplayMode,
  useInputDisplayMode,
} from "@/hooks/useInputDisplayMode";
import { cn } from "@/lib/utils";
import { tracking } from "@/utils/tracking";

const INPUT_DISPLAY_OPTIONS: {
  value: InputDisplayMode;
  label: string;
  icon: IconName;
}[] = [
  { value: "separate", label: "Separate", icon: "Boxes" },
  { value: "clustered", label: "Clustered", icon: "Group" },
  { value: "embedded", label: "Embedded", icon: "Combine" },
];

export function InputDisplaySetting() {
  const mode = useInputDisplayMode();

  return (
    <BlockStack gap="2">
      <BlockStack>
        <Paragraph>Input display</Paragraph>
        <Paragraph size="sm" tone="subdued">
          Choose how pipeline inputs appear on the editor canvas. Clustered
          groups related inputs into a single node; embedded hides connected
          inputs and shows their values on the consuming task.
        </Paragraph>
      </BlockStack>
      <div
        role="radiogroup"
        aria-label="Input display"
        className="flex w-fit gap-1 rounded-md border border-border p-0.5"
      >
        {INPUT_DISPLAY_OPTIONS.map((option) => {
          const isActive = mode === option.value;
          return (
            <Button
              key={option.value}
              variant={isActive ? "secondary" : "ghost"}
              size="sm"
              role="radio"
              aria-checked={isActive}
              onClick={() => setInputDisplayMode(option.value)}
              className={cn(!isActive && "text-muted-foreground")}
              data-testid={`input-display-option-${option.value}`}
              {...tracking("settings.input_display.mode_select", {
                mode: option.value,
              })}
            >
              <Icon name={option.icon} size="sm" />
              {option.label}
            </Button>
          );
        })}
      </div>
    </BlockStack>
  );
}
