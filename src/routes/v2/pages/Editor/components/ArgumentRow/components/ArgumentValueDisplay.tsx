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
  if (editing && !externalEditor) {
    return (
      <AutoGrowTextarea
        autoFocus
        key={`${task.$id}-${inputSpec.name}-${String(currentValue ?? "")}`}
        defaultValue={typeof currentValue === "string" ? currentValue : ""}
        expandDialogTitle={`Value for ${inputSpec.name}`}
        onChangeComplete={onChangeComplete}
        onBlur={onBlur}
        highlightSyntax
        placeholder={
          isBound
            ? bindingLabel || "Enter value to replace connection..."
            : (inputSpec.default ?? "Enter value...")
        }
        className="min-h-2 text-xs font-mono mt-1"
        data-testid="argument-input"
      />
    );
  }

  if (isDynamic && dynamicDisplayInfo) {
    return (
      <InlineStack gap="1" blockAlign="center" className="mt-0.5">
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

  if (!displayValue) return null;

  return (
    <Text
      size="xs"
      font="mono"
      className={cn(
        "truncate block mt-0.5",
        isBound ? "text-blue-600" : "text-gray-500",
      )}
      title={displayValue}
    >
      {displayValue}
    </Text>
  );
}
