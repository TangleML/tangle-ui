import { observer } from "mobx-react-lite";
import { type ChangeEvent, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import type {
  Binding,
  ComponentSpec,
  ComponentSpecJson,
  InputSpecJson,
  Task,
} from "@/models/componentSpec";

import { useSpec } from "../providers/SpecContext";
import { editorStore, setFocusedArgument } from "../store/editorStore";

interface TaskArgumentsEditorProps {
  task: Task;
}

export const TaskArgumentsEditor = observer(function TaskArgumentsEditor({
  task,
}: TaskArgumentsEditorProps) {
  const spec = useSpec();
  const componentSpec = task.componentRef.spec as ComponentSpecJson | undefined;
  const inputs = componentSpec?.inputs ?? [];

  if (!spec || inputs.length === 0) {
    return (
      <Text size="xs" tone="subdued" className="px-3 py-2">
        No inputs defined
      </Text>
    );
  }

  const taskBindings = spec.bindings.filter(
    (b) => b.targetEntityId === task.$id,
  );

  return (
    <BlockStack gap="1">
      {inputs.map((inputSpec) => {
        const arg = task.arguments.find((a) => a.name === inputSpec.name);
        const binding = taskBindings.find(
          (b) => b.targetPortName === inputSpec.name,
        );
        return (
          <ArgumentRow
            key={inputSpec.name}
            inputSpec={inputSpec}
            currentValue={arg?.value}
            isSet={arg !== undefined}
            binding={binding}
            task={task}
            spec={spec}
          />
        );
      })}
    </BlockStack>
  );
});

interface ArgumentRowProps {
  inputSpec: InputSpecJson;
  currentValue: unknown;
  isSet: boolean;
  binding: Binding | undefined;
  task: Task;
  spec: ComponentSpec;
}

const ArgumentRow = observer(function ArgumentRow({
  inputSpec,
  currentValue,
  isSet,
  binding,
  task,
  spec,
}: ArgumentRowProps) {
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState(
    typeof currentValue === "string" ? currentValue : "",
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);

  const isFocused = editorStore.focusedArgumentName === inputSpec.name;
  const isBound = binding !== undefined;

  useEffect(() => {
    if (isFocused) {
      setEditing(true);
      rowRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [isFocused]);

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
        task.removeArgumentByName(inputSpec.name);
      } else {
        spec.setTaskArgument(task.$id, inputSpec.name, trimmed);
      }
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      inputRef.current?.blur();
    }
    if (e.key === "Escape") {
      setInputValue(typeof currentValue === "string" ? currentValue : "");
      setEditing(false);
      if (isFocused) setFocusedArgument(null);
    }
  };

  const handleToggleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isSet || isBound) {
      task.removeArgumentByName(inputSpec.name);
      setInputValue("");
    } else {
      const defaultVal = inputSpec.default ?? "";
      spec.setTaskArgument(task.$id, inputSpec.name, defaultVal);
      setInputValue(defaultVal);
    }
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
        "group rounded px-2 py-1 cursor-pointer transition-colors w-full",
        editing ? "bg-blue-50 ring-1 ring-blue-200" : "hover:bg-gray-50",
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
        </InlineStack>

        <Button
          variant="ghost"
          size="xs"
          className="invisible group-hover:visible h-5 w-5 p-0 shrink-0"
          onClick={handleToggleRemove}
        >
          <Icon
            name={isSet || isBound ? "X" : "Plus"}
            size="xs"
            className={isSet || isBound ? "text-gray-400" : "text-blue-500"}
          />
        </Button>
      </InlineStack>

      {editing ? (
        <Input
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
          className="h-7 text-xs font-mono mt-1"
        />
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
