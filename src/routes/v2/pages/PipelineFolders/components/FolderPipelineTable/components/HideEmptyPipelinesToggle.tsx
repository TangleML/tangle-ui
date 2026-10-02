import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";

const CHECKBOX_ID = "hide-empty-pipelines";

interface HideEmptyPipelinesToggleProps {
  checked: boolean;
  hiddenCount: number;
  onChange: (checked: boolean) => void;
}

export function HideEmptyPipelinesToggle({
  checked,
  hiddenCount,
  onChange,
}: HideEmptyPipelinesToggleProps) {
  return (
    <InlineStack gap="2" blockAlign="center">
      <Checkbox
        id={CHECKBOX_ID}
        checked={checked}
        onCheckedChange={(next) => {
          if (next === "indeterminate") return;
          onChange(next);
        }}
      />
      <Label htmlFor={CHECKBOX_ID} className="font-normal">
        <Text size="sm" tone="subdued">
          {hiddenCount > 0
            ? `Hide empty pipelines (${hiddenCount})`
            : "Hide empty pipelines"}
        </Text>
      </Label>
    </InlineStack>
  );
}
