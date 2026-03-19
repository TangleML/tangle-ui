import { observer } from "mobx-react-lite";
import { type ChangeEvent, useEffect, useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import { InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import type { ArgumentType, ComponentSpec } from "@/models/componentSpec";
import type { AggregatedArgument } from "@/routes/v2/pages/Editor/components/ContextPanel/components/MultiSelectionDetails/utils";
import { ThunderMenu } from "@/routes/v2/pages/Editor/components/ThunderMenu";
import { createInputAndConnect } from "@/routes/v2/pages/Editor/store/actions";
import { withUndoGroup } from "@/routes/v2/pages/Editor/store/undoStore";
import type { DynamicDataArgument } from "@/utils/componentSpec";

interface BatchArgumentRowProps {
  aggArg: AggregatedArgument;
  spec: ComponentSpec;
}

export const BatchArgumentRow = observer(function BatchArgumentRow({
  aggArg,
  spec,
}: BatchArgumentRowProps) {
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState(aggArg.value);
  const inputRef = useRef<HTMLInputElement>(null);

  const hasValue = aggArg.value !== "" || aggArg.isMixed;
  const canReset = aggArg.defaultValue !== undefined;
  const canUnset = hasValue;

  useEffect(() => {
    setInputValue(aggArg.value);
  }, [aggArg.value]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editing]);

  const handleClick = () => {
    setEditing(true);
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleBlur = () => {
    setEditing(false);
    commitValue();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      inputRef.current?.blur();
    }
    if (e.key === "Escape") {
      setInputValue(aggArg.value);
      setEditing(false);
    }
  };

  const commitValue = () => {
    const trimmed = inputValue.trim();

    if (aggArg.isMixed && trimmed === "") return;
    if (!aggArg.isMixed && trimmed === aggArg.value) return;

    withUndoGroup("Batch argument update", () => {
      for (const taskId of aggArg.taskIds) {
        if (trimmed === "") {
          const task = spec.tasks.find((t) => t.$id === taskId);
          task?.removeArgumentByName(aggArg.name);
        } else {
          spec.setTaskArgument(taskId, aggArg.name, trimmed);
        }
      }
    });
  };

  const handleResetToDefault = () => {
    const defaultVal = aggArg.defaultValue ?? "";
    withUndoGroup("Batch reset to default", () => {
      for (const taskId of aggArg.taskIds) {
        spec.setTaskArgument(taskId, aggArg.name, defaultVal);
      }
    });
    setInputValue(defaultVal);
  };

  const handleUnset = () => {
    withUndoGroup("Batch unset argument", () => {
      for (const taskId of aggArg.taskIds) {
        const task = spec.tasks.find((t) => t.$id === taskId);
        task?.removeArgumentByName(aggArg.name);
        spec.removeAllBindingsBy(
          (b) =>
            b.targetEntityId === taskId && b.targetPortName === aggArg.name,
        );
      }
    });
    setInputValue("");
  };

  const handleSelectDynamicData = (value: DynamicDataArgument) => {
    // Model ArgumentType doesn't include DynamicDataArgument, but it's stored correctly at runtime
    const argValue = value as unknown as ArgumentType;
    withUndoGroup("Batch set dynamic data", () => {
      for (const taskId of aggArg.taskIds) {
        spec.setTaskArgument(taskId, aggArg.name, argValue);
      }
    });
    setInputValue("");
  };

  const handleQuickConnect = (
    sourceEntityId: string,
    sourcePortName: string,
  ) => {
    withUndoGroup("Batch quick connect", () => {
      for (const taskId of aggArg.taskIds) {
        spec.connectNodes(
          { entityId: sourceEntityId, portName: sourcePortName },
          { entityId: taskId, portName: aggArg.name },
        );
      }
    });
    setInputValue("");
  };

  const handleCreateInputAndConnect = () => {
    createInputAndConnect(spec, aggArg.taskIds, aggArg.name, aggArg.type);
    setInputValue("");
  };

  return (
    <div
      className={cn(
        "group rounded px-2 py-1 cursor-pointer transition-colors w-full",
        editing ? "bg-blue-50 ring-1 ring-blue-200" : "hover:bg-gray-50",
        !hasValue && "opacity-60",
      )}
      onClick={handleClick}
    >
      <InlineStack gap="1" blockAlign="center" className="w-full min-h-[24px]">
        <InlineStack gap="1" blockAlign="baseline" className="flex-1 min-w-0">
          <Text size="xs" weight="semibold" className="shrink-0 text-gray-700">
            {aggArg.name}
          </Text>
          {aggArg.typeLabel && (
            <Text size="xs" className="text-gray-400 shrink-0">
              {aggArg.typeLabel}
            </Text>
          )}
          {!aggArg.optional && (
            <Text size="xs" className="text-red-400 shrink-0">
              *
            </Text>
          )}
        </InlineStack>
        <Text size="xs" className="text-gray-400 shrink-0 mr-1">
          {aggArg.taskIds.length} tasks
        </Text>
        <ThunderMenu
          inputName={aggArg.name}
          inputType={aggArg.type}
          canReset={canReset}
          canUnset={canUnset}
          excludeEntityIds={aggArg.taskIds}
          onResetToDefault={handleResetToDefault}
          onUnset={handleUnset}
          onSelectDynamicData={handleSelectDynamicData}
          onQuickConnect={handleQuickConnect}
          onCreateInputAndConnect={handleCreateInputAndConnect}
        />
      </InlineStack>

      {editing ? (
        <Input
          ref={inputRef}
          value={inputValue}
          onChange={handleChange}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder={
            aggArg.isMixed ? "mixed" : (aggArg.defaultValue ?? "Enter value...")
          }
          className="h-7 text-xs font-mono mt-1"
        />
      ) : (
        <Text
          size="xs"
          font="mono"
          className={cn(
            "truncate block mt-0.5",
            aggArg.isMixed ? "text-amber-500 italic" : "text-gray-500",
          )}
          title={aggArg.isMixed ? "Values differ across tasks" : aggArg.value}
        >
          {aggArg.isMixed ? "mixed" : aggArg.value || null}
        </Text>
      )}
    </div>
  );
});
