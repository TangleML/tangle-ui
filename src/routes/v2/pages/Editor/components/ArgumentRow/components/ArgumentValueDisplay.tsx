import type { getDynamicDataDisplayInfo } from "@/components/shared/ReactFlow/FlowCanvas/TaskNode/ArgumentsEditor/dynamicDataUtils";
import { Icon } from "@/components/ui/icon";
import { InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import type { InputSpec, Task } from "@/models/componentSpec";
import { AutoGrowTextarea } from "@/routes/v2/pages/Editor/components/AutoGrowTextArea";

type DynamicDataDisplayInfo = NonNullable<
  ReturnType<typeof getDynamicDataDisplayInfo>
>;

interface ArgumentValueDisplayProps {
  editing: boolean;
  externalEditor?: boolean;
  isDynamic: boolean;
  dynamicDisplayInfo: DynamicDataDisplayInfo | null;
  isBound: boolean;
  bindingLabel: string | undefined;
  displayValue: string;
  task: Task;
  inputSpec: InputSpec;
  currentValue: unknown;
  onChangeComplete: (value: string) => void;
  onBlur: () => void;
}

export function ArgumentValueDisplay({
  editing,
  externalEditor,
  isDynamic,
  dynamicDisplayInfo,
  isBound,
  bindingLabel,
  displayValue,
  task,
  inputSpec,
  currentValue,
  onChangeComplete,
  onBlur,
}: ArgumentValueDisplayProps) {
  if (isDynamic && dynamicDisplayInfo) {
    return (
      <InlineStack gap="1" blockAlign="center" className="mt-1">
        <Icon
          name={dynamicDisplayInfo.icon}
          size="xs"
          className={dynamicDisplayInfo.textColor}
        />
        <Text
          size="xs"
          font="mono"
          className={cn("truncate", dynamicDisplayInfo.textColor)}
        >
          {dynamicDisplayInfo.displayValue}
        </Text>
      </InlineStack>
    );
  }

  const isUnset = !displayValue && !isBound;
  const placeholder = isBound
    ? bindingLabel || "Enter value to replace connection..."
    : (inputSpec.default ?? "");

  // Always show the input field (V1 style)
  return (
    <AutoGrowTextarea
      autoFocus={editing && !externalEditor}
      key={`${task.$id}-${inputSpec.name}-${String(currentValue ?? "")}`}
      defaultValue={typeof currentValue === "string" ? currentValue : ""}
      expandDialogTitle={`Value for ${inputSpec.name}`}
      onChangeComplete={onChangeComplete}
      onBlur={onBlur}
      highlightSyntax
      placeholder={isBound ? bindingLabel || "" : placeholder}
      className={cn(
        "min-h-2 text-sm font-mono mt-1 rounded-lg",
        isBound && "text-blue-600",
        isUnset && "border-dashed border-gray-300",
      )}
      data-testid="argument-input"
    />
  );
}
