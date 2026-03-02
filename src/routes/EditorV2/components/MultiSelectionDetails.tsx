import { useEffect, useState } from "react";
import { useSnapshot } from "valtio";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Separator } from "@/components/ui/separator";
import { Text } from "@/components/ui/typography";
import type { ComponentSpec } from "@/models/componentSpec";

import { useSpec } from "../providers/SpecContext";
import { executeCommand } from "../store/commandManager";
import { CreateSubgraphCommand } from "../store/commands";
import {
  clearMultiSelection,
  editorStore,
  type SelectedNode,
} from "../store/editorStore";

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

/**
 * Content for multi-selection in the Properties window.
 * Shows list of selected nodes and Create Subgraph section when 2+ tasks selected.
 */
export function MultiSelectionDetails() {
  const snapshot = useSnapshot(editorStore);
  const { multiSelection } = snapshot;
  // Use current spec from SpecContext
  const spec = useSpec();

  const [subgraphName, setSubgraphName] = useState("");

  // Filter to only task nodes
  const selectedTasks = multiSelection.filter((node) => node.type === "task");
  const canCreateSubgraph = selectedTasks.length >= 2;

  // Update default subgraph name when selection changes
  useEffect(() => {
    if (canCreateSubgraph) {
      setSubgraphName(`Subgraph (${selectedTasks.length} tasks)`);
    }
  }, [canCreateSubgraph, selectedTasks.length]);

  const handleCreateSubgraph = () => {
    if (!subgraphName.trim() || !canCreateSubgraph || !spec) return;

    // Get task names from entity IDs
    const taskNames = selectedTasks.map((node) =>
      getNodeDisplayName(node, spec),
    );

    // Calculate center position of selected task nodes
    const centerX =
      selectedTasks.reduce((sum, node) => sum + node.position.x, 0) /
      selectedTasks.length;
    const centerY =
      selectedTasks.reduce((sum, node) => sum + node.position.y, 0) /
      selectedTasks.length;

    const success = executeCommand(
      new CreateSubgraphCommand(spec, taskNames, subgraphName.trim(), {
        x: centerX,
        y: centerY,
      }),
    );

    if (success) {
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
}
