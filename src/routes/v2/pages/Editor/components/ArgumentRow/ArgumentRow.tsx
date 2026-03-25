import { observer } from "mobx-react-lite";
import { useEffect, useRef, useState } from "react";

import { getDynamicDataDisplayInfo } from "@/components/shared/ReactFlow/FlowCanvas/TaskNode/ArgumentsEditor/dynamicDataUtils";
import { InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import type {
  Binding,
  ComponentSpec,
  InputSpec,
  Task,
} from "@/models/componentSpec";
import { useIOActions } from "@/routes/v2/pages/Editor/store/actions/useIOActions";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";
import type { DynamicDataArgument } from "@/utils/componentSpec";

import {
  formatBindingSource,
  getDisplayValue,
  typeSpecToString,
} from "./argumentRow.utils";
import { ArgumentValueDisplay } from "./components/ArgumentValueDisplay";
import { InputValidationIndicator } from "./components/InputValidationIndicator";
import { ThunderMenu } from "./components/ThunderMenu/ThunderMenu";
import { useArgumentActions } from "./useArgumentActions";

interface ArgumentRowProps {
  inputSpec: InputSpec;
  currentValue: unknown;
  isSet: boolean;
  binding: Binding | undefined;
  task: Task;
  spec: ComponentSpec;
  externalEditor?: boolean;
  onSelectionChanged?: (name: string) => void;
}

export const ArgumentRow = observer(function ArgumentRow({
  inputSpec,
  currentValue,
  isSet,
  binding,
  task,
  spec,
  externalEditor,
  onSelectionChanged,
}: ArgumentRowProps) {
  const { editor } = useSharedStores();
  const {
    setArgument,
    removeArgument,
    resetArgumentToDefault,
    unsetArgument,
    setDynamicData,
    quickConnect,
  } = useArgumentActions();
  const { createInputAndConnect } = useIOActions();
  const [editing, setEditing] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);

  const isFocused = editor.focusedArgumentName === inputSpec.name;
  const isBound = binding !== undefined;

  const isDynamic =
    typeof currentValue === "object" &&
    currentValue !== null &&
    "dynamicData" in currentValue;
  const dynamicDisplayInfo = isDynamic
    ? getDynamicDataDisplayInfo(
        (currentValue as DynamicDataArgument).dynamicData,
      )
    : null;

  const taskAnnotations = Object.fromEntries(
    task.annotations.map((a) => [a.key, a.value]),
  );

  const canReset =
    inputSpec.default !== undefined &&
    (typeof currentValue !== "string" || currentValue !== inputSpec.default);
  const canUnset = isSet || isBound;

  useEffect(() => {
    if (isFocused) {
      if (!externalEditor) setEditing(true);
      rowRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [isFocused, externalEditor]);

  const handleClick = () => {
    if (isDynamic) return;
    onSelectionChanged?.(inputSpec.name);
    if (externalEditor) {
      editor.setFocusedArgument(inputSpec.name);
      return;
    }
    setEditing(true);
  };

  const handleBlur = () => {
    setEditing(false);
    if (isFocused) {
      editor.setFocusedArgument(null);
    }
  };

  const handleChangeComplete = (value: string) => {
    const trimmed = value.trim();
    if (trimmed === "" && !isSet && !isBound) return;

    if (trimmed !== (typeof currentValue === "string" ? currentValue : "")) {
      if (trimmed === "" && isSet) {
        removeArgument(task, inputSpec.name);
      } else {
        setArgument(spec, task.$id, inputSpec.name, trimmed);
      }
    }

    handleBlur();
  };

  const handleResetToDefault = () => {
    const defaultVal = inputSpec.default ?? "";
    resetArgumentToDefault(spec, task.$id, inputSpec.name, defaultVal);
  };

  const handleUnset = () => {
    unsetArgument(task, spec, inputSpec.name);
  };

  const handleSelectDynamicData = (value: DynamicDataArgument) => {
    setDynamicData(spec, task.$id, inputSpec.name, value);
  };

  const handleQuickConnect = (
    sourceEntityId: string,
    sourcePortName: string,
  ) => {
    quickConnect(
      spec,
      sourceEntityId,
      sourcePortName,
      task.$id,
      inputSpec.name,
    );
  };

  const handleCreateInputAndConnect = () => {
    createInputAndConnect(spec, [task.$id], inputSpec.name, inputSpec.type);
  };

  const bindingLabel = isBound ? formatBindingSource(binding, spec) : undefined;
  const displayValue = isBound
    ? bindingLabel
    : getDisplayValue(currentValue, isSet, inputSpec);
  const typeLabel = typeSpecToString(inputSpec.type);

  return (
    <div
      ref={rowRef}
      className={cn(
        "group rounded px-2 py-1 cursor-pointer transition-colors w-full overflow-hidden",
        externalEditor && isFocused
          ? "bg-blue-50 ring-1 ring-blue-200"
          : editing
            ? "bg-blue-50 ring-1 ring-blue-200"
            : "hover:bg-gray-50",
        !isSet && !isBound && "opacity-60",
      )}
      onClick={handleClick}
    >
      <InlineStack gap="1" blockAlign="center" className="w-full min-h-[24px]">
        <InlineStack gap="1" blockAlign="baseline" className="flex-1 min-w-0">
          <Text
            size="xs"
            weight="semibold"
            className={cn(
              "shrink-0 text-gray-700",
              !isSet && !isBound && "line-through",
            )}
          >
            {inputSpec.name}
          </Text>
          {typeLabel && (
            <Text size="xs" className="text-gray-400 shrink-0">
              {typeLabel}
            </Text>
          )}
          {!inputSpec.optional && (
            <Text size="xs" className="text-red-400 shrink-0">
              *
            </Text>
          )}
          <InputValidationIndicator
            entityId={task.$id}
            inputName={inputSpec.name}
          />
        </InlineStack>

        <ThunderMenu
          inputName={inputSpec.name}
          inputType={inputSpec.type}
          canReset={canReset}
          canUnset={canUnset}
          excludeEntityIds={[task.$id]}
          taskAnnotations={taskAnnotations}
          onResetToDefault={handleResetToDefault}
          onUnset={handleUnset}
          onSelectDynamicData={handleSelectDynamicData}
          onQuickConnect={handleQuickConnect}
          onCreateInputAndConnect={handleCreateInputAndConnect}
        />
      </InlineStack>

      <ArgumentValueDisplay
        editing={editing}
        externalEditor={externalEditor}
        isDynamic={isDynamic}
        dynamicDisplayInfo={dynamicDisplayInfo}
        isBound={isBound}
        bindingLabel={bindingLabel}
        displayValue={displayValue ?? ""}
        task={task}
        inputSpec={inputSpec}
        currentValue={currentValue}
        onChangeComplete={handleChangeComplete}
        onBlur={handleBlur}
      />
    </div>
  );
});
