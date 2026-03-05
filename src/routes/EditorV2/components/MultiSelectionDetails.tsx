import { observer } from "mobx-react-lite";
import { type ChangeEvent, useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Separator } from "@/components/ui/separator";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import type {
  ArgumentType,
  ComponentSpec,
  ComponentSpecJson,
  Task,
  TypeSpecType,
} from "@/models/componentSpec";
import type { DynamicDataArgument } from "@/utils/componentSpec";

import { useSpec } from "../providers/SpecContext";
import { createInputAndConnect, createSubgraph } from "../store/actions";
import {
  clearMultiSelection,
  editorStore,
  type SelectedNode,
} from "../store/editorStore";
import { undoStore } from "../store/undoStore";
import { ThunderMenu } from "./ThunderMenu";

interface BatchArgumentRowProps {
  aggArg: AggregatedArgument;
  spec: ComponentSpec;
}

const BatchArgumentRow = observer(function BatchArgumentRow({
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

    undoStore.undoManager?.withGroup("Batch argument update", () => {
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
    undoStore.undoManager?.withGroup("Batch reset to default", () => {
      for (const taskId of aggArg.taskIds) {
        spec.setTaskArgument(taskId, aggArg.name, defaultVal);
      }
    });
    setInputValue(defaultVal);
  };

  const handleUnset = () => {
    undoStore.undoManager?.withGroup("Batch unset argument", () => {
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
    undoStore.undoManager?.withGroup("Batch set dynamic data", () => {
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
    undoStore.undoManager?.withGroup("Batch quick connect", () => {
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

/**
 * Get the display name for a node based on its type and ID.
 */
function getNodeDisplayName(
  node: SelectedNode,
  spec: ComponentSpec | null,
): string {
  if (!spec) return node.id;

  switch (node.type) {
    case "task": {
      const task = spec.tasks.find((t) => t.$id === node.id);
      return task?.name ?? node.id;
    }
    case "input": {
      const input = spec.inputs.find((i) => i.$id === node.id);
      return input?.name ?? node.id;
    }
    case "output": {
      const output = spec.outputs.find((o) => o.$id === node.id);
      return output?.name ?? node.id;
    }
    default:
      return node.id;
  }
}

/**
 * Get the icon name for a node type.
 */
function getNodeIcon(type: SelectedNode["type"]): string {
  switch (type) {
    case "task":
      return "Workflow";
    case "input":
      return "Download";
    case "output":
      return "Upload";
  }
}

/**
 * Get the icon color class for a node type.
 */
function getNodeIconColor(type: SelectedNode["type"]): string {
  switch (type) {
    case "task":
      return "text-blue-500";
    case "input":
      return "text-blue-500";
    case "output":
      return "text-green-500";
  }
}

interface AggregatedArgument {
  name: string;
  type?: TypeSpecType;
  typeLabel: string;
  optional: boolean;
  defaultValue?: string;
  /** The shared value across all tasks, or empty string when mixed. */
  value: string;
  isMixed: boolean;
  /** Task IDs that have this input in their component spec. */
  taskIds: string[];
}

function typeSpecToString(typeSpec?: TypeSpecType): string {
  if (typeSpec === undefined) return "";
  if (typeof typeSpec === "string") return typeSpec;
  return JSON.stringify(typeSpec);
}

/**
 * Aggregate arguments across selected tasks. Two inputs match when they share
 * the same name and serialized type. Only arguments present in 2+ tasks are returned.
 */
function computeAggregatedArguments(tasks: Task[]): AggregatedArgument[] {
  const map = new Map<
    string,
    {
      name: string;
      type?: TypeSpecType;
      typeLabel: string;
      optional: boolean;
      defaultValue?: string;
      values: Array<string | undefined>;
      taskIds: string[];
    }
  >();

  for (const task of tasks) {
    const componentSpec = task.componentRef.spec as
      | ComponentSpecJson
      | undefined;
    const inputs = componentSpec?.inputs ?? [];

    for (const inputSpec of inputs) {
      const key = `${inputSpec.name}::${JSON.stringify(inputSpec.type)}`;
      const arg = task.arguments.find((a) => a.name === inputSpec.name);
      const effectiveValue =
        arg !== undefined && typeof arg.value === "string"
          ? arg.value
          : undefined;

      const existing = map.get(key);
      if (existing) {
        existing.values.push(effectiveValue);
        existing.taskIds.push(task.$id);
        if (!inputSpec.optional) existing.optional = false;
      } else {
        map.set(key, {
          name: inputSpec.name,
          type: inputSpec.type,
          typeLabel: typeSpecToString(inputSpec.type),
          optional: inputSpec.optional ?? true,
          defaultValue: inputSpec.default,
          values: [effectiveValue],
          taskIds: [task.$id],
        });
      }
    }
  }

  const result: AggregatedArgument[] = [];
  for (const entry of map.values()) {
    if (entry.taskIds.length < 2) continue;

    const firstValue = entry.values[0];
    const allSame = entry.values.every((v) => v === firstValue);

    result.push({
      name: entry.name,
      type: entry.type,
      typeLabel: entry.typeLabel,
      optional: entry.optional,
      defaultValue: entry.defaultValue,
      value: allSame && firstValue !== undefined ? firstValue : "",
      isMixed: !allSame,
      taskIds: entry.taskIds,
    });
  }

  return result;
}

/**
 * Content for multi-selection in the Properties window.
 * Shows list of selected nodes, common argument editing, and Create Subgraph section.
 */
export const MultiSelectionDetails = observer(function MultiSelectionDetails() {
  const { multiSelection } = editorStore;
  const spec = useSpec();

  const [subgraphName, setSubgraphName] = useState("");

  const selectedTasks = multiSelection.filter((node) => node.type === "task");
  const canCreateSubgraph = selectedTasks.length >= 2;

  const resolvedTasks = spec
    ? selectedTasks
        .map((node) => spec.tasks.find((t) => t.$id === node.id))
        .filter((t): t is Task => t !== undefined)
    : [];

  const aggregatedArgs = computeAggregatedArguments(resolvedTasks);

  useEffect(() => {
    if (canCreateSubgraph) {
      setSubgraphName(`Subgraph (${selectedTasks.length} tasks)`);
    }
  }, [canCreateSubgraph, selectedTasks.length]);

  const handleCreateSubgraph = () => {
    if (!subgraphName.trim() || !canCreateSubgraph || !spec) return;

    const taskIds = selectedTasks.map((node) => node.id);

    const centerX =
      selectedTasks.reduce((sum, node) => sum + node.position.x, 0) /
      selectedTasks.length;
    const centerY =
      selectedTasks.reduce((sum, node) => sum + node.position.y, 0) /
      selectedTasks.length;

    const result = createSubgraph(spec, taskIds, subgraphName.trim(), {
      x: centerX,
      y: centerY,
    });

    if (result) {
      setSubgraphName("");
      clearMultiSelection();
    }
  };

  if (multiSelection.length === 0) {
    return null;
  }

  return (
    <BlockStack className="h-full bg-white overflow-y-auto">
      <BlockStack gap="4" className="p-3">
        {/* Header */}
        <InlineStack gap="2" blockAlign="center">
          <Icon name="MousePointer2" size="sm" className="text-blue-500" />
          <Text size="sm" weight="semibold" className="text-slate-700">
            {multiSelection.length} nodes selected
          </Text>
        </InlineStack>

        {/* Selected Nodes List */}
        <BlockStack gap="2">
          <Label className="text-gray-600">Selected Nodes</Label>
          <BlockStack gap="1" className="max-h-48 overflow-y-auto">
            {multiSelection.map((node) => (
              <InlineStack
                key={node.id}
                gap="2"
                blockAlign="center"
                className="text-xs py-1.5 px-2 bg-slate-50 rounded border border-slate-100"
              >
                <Icon
                  name={getNodeIcon(node.type) as any}
                  size="xs"
                  className={`shrink-0 ${getNodeIconColor(node.type)}`}
                />
                <Text size="xs" className="text-slate-700 truncate flex-1">
                  {getNodeDisplayName(node, spec)}
                </Text>
                <Text size="xs" className="text-slate-400 capitalize">
                  {node.type}
                </Text>
              </InlineStack>
            ))}
          </BlockStack>
        </BlockStack>

        {/* Common Arguments Section */}
        {spec && aggregatedArgs.length > 0 && (
          <>
            <Separator />
            <BlockStack gap="2">
              <InlineStack gap="2" blockAlign="center">
                <Label className="text-gray-600">Common Arguments</Label>
                <Badge
                  variant="secondary"
                  className="text-[10px] px-1.5 py-0 h-4"
                >
                  {aggregatedArgs.length}
                </Badge>
              </InlineStack>
              <BlockStack gap="1">
                {aggregatedArgs.map((aggArg) => (
                  <BatchArgumentRow
                    key={`${aggArg.name}::${aggArg.typeLabel}`}
                    aggArg={aggArg}
                    spec={spec}
                  />
                ))}
              </BlockStack>
            </BlockStack>
          </>
        )}

        {/* Create Subgraph Section - only when 2+ tasks */}
        {canCreateSubgraph && (
          <>
            <Separator />
            <BlockStack gap="3">
              <BlockStack gap="1">
                <Label className="text-gray-600">Create Subgraph</Label>
                <Text size="xs" className="text-gray-400">
                  Group {selectedTasks.length} tasks into a reusable component
                </Text>
              </BlockStack>

              <BlockStack gap="2">
                <Input
                  value={subgraphName}
                  onChange={(e) => setSubgraphName(e.target.value)}
                  placeholder="Subgraph name..."
                  className="text-sm"
                />
                <Button
                  onClick={handleCreateSubgraph}
                  disabled={!subgraphName.trim()}
                  className="w-full gap-1.5"
                  size="sm"
                >
                  <Icon name="FolderInput" size="sm" />
                  Create Subgraph
                </Button>
              </BlockStack>
            </BlockStack>
          </>
        )}
      </BlockStack>
    </BlockStack>
  );
});
