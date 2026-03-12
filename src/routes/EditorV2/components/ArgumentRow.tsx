import { observer } from "mobx-react-lite";
import { type ChangeEvent, useEffect, useRef, useState } from "react";

import { getDynamicDataDisplayInfo } from "@/components/shared/ReactFlow/FlowCanvas/TaskNode/ArgumentsEditor/dynamicDataUtils";
import { Icon } from "@/components/ui/icon";
import { InlineStack } from "@/components/ui/layout";
import { Textarea } from "@/components/ui/textarea";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import type {
  Binding,
  ComponentSpec,
  InputSpecJson,
  Task,
} from "@/models/componentSpec";
import type { DynamicDataArgument } from "@/utils/componentSpec";

import { createInputAndConnect } from "../store/actions";
import { editorStore, setFocusedArgument } from "../store/editorStore";
import {
  quickConnect,
  removeArgument,
  resetArgumentToDefault,
  setArgument,
  setDynamicData,
  unsetArgument,
} from "./arguments.actions";
import { InputValidationIndicator } from "./InputValidationIndicator";
import { ThunderMenu } from "./ThunderMenu";

interface ArgumentRowProps {
  inputSpec: InputSpecJson;
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
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState(
    typeof currentValue === "string" ? currentValue : "",
  );
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);

  const isFocused = editorStore.focusedArgumentName === inputSpec.name;
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

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editing]);

  useEffect(() => {
    if (typeof currentValue === "string") {
      setInputValue(currentValue);
    } else if (currentValue === undefined) {
      setInputValue("");
    }
  }, [currentValue]);

  const handleClick = () => {
    if (isDynamic) return;
    onSelectionChanged?.(inputSpec.name);
    if (externalEditor) {
      setFocusedArgument(inputSpec.name);
      return;
    }
    setEditing(true);
  };

  const handleBlur = () => {
    setEditing(false);
    if (isFocused) {
      setFocusedArgument(null);
    }

    const trimmed = inputValue.trim();
    if (trimmed === "" && !isSet && !isBound) return;

    if (trimmed !== (typeof currentValue === "string" ? currentValue : "")) {
      if (trimmed === "" && isSet) {
        removeArgument(task, inputSpec.name);
      } else {
        setArgument(spec, task.$id, inputSpec.name, trimmed);
      }
    }
  };

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      inputRef.current?.blur();
    }
    if (e.key === "Escape") {
      setInputValue(typeof currentValue === "string" ? currentValue : "");
      setEditing(false);
      if (isFocused) setFocusedArgument(null);
    }
  };

  const handleResetToDefault = () => {
    const defaultVal = inputSpec.default ?? "";
    resetArgumentToDefault(spec, task.$id, inputSpec.name, defaultVal);
    setInputValue(defaultVal);
  };

  const handleUnset = () => {
    unsetArgument(task, spec, inputSpec.name);
    setInputValue("");
  };

  const handleSelectDynamicData = (value: DynamicDataArgument) => {
    setDynamicData(spec, task.$id, inputSpec.name, value);
    setInputValue("");
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
    setInputValue("");
  };

  const handleCreateInputAndConnect = () => {
    createInputAndConnect(spec, [task.$id], inputSpec.name, inputSpec.type);
    setInputValue("");
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

      {editing && !externalEditor ? (
        <Textarea
          ref={inputRef}
          value={inputValue}
          onChange={handleChange}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder={
            isBound
              ? bindingLabel || "Enter value to replace connection..."
              : (inputSpec.default ?? "Enter value...")
          }
          className="min-h-2 resize-y text-xs font-mono mt-1"
        />
      ) : isDynamic && dynamicDisplayInfo ? (
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
      ) : (
        displayValue && (
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
        )
      )}
    </div>
  );
});

function formatBindingSource(binding: Binding, spec: ComponentSpec): string {
  const sourceInput = spec.inputs.find((i) => i.$id === binding.sourceEntityId);
  if (sourceInput) {
    return `graphInput: ${sourceInput.name}`;
  }

  const sourceTask = spec.tasks.find((t) => t.$id === binding.sourceEntityId);
  if (sourceTask) {
    return `${sourceTask.name}.${binding.sourcePortName}`;
  }

  return `${binding.sourceEntityId}.${binding.sourcePortName}`;
}

function getDisplayValue(
  value: unknown,
  isSet: boolean,
  inputSpec: InputSpecJson,
): string {
  if (!isSet) {
    return inputSpec.default ? `default: ${inputSpec.default}` : "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (value !== undefined && value !== null) {
    return JSON.stringify(value);
  }

  return "";
}

function typeSpecToString(typeSpec?: unknown): string {
  if (typeSpec === undefined) return "";
  if (typeof typeSpec === "string") return typeSpec;
  return JSON.stringify(typeSpec);
}
