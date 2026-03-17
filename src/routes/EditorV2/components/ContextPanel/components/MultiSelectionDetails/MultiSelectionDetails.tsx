import { useReactFlow } from "@xyflow/react";
import { observer } from "mobx-react-lite";
import { useEffect, useState } from "react";

import { autoLayoutNodes } from "@/components/shared/ReactFlow/FlowCanvas/utils/autolayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Separator } from "@/components/ui/separator";
import { Text } from "@/components/ui/typography";
import type { Task } from "@/models/componentSpec";

import { useSpec } from "../../../../providers/SpecContext";
import {
  applyAutoLayoutPositions,
  createSubgraph,
} from "../../../../store/actions";
import {
  clearMultiSelection,
  editorStore,
} from "../../../../store/editorStore";
import { BatchArgumentRow } from "./components/BatchArgumentRow";
import { BatchTaskColor } from "./components/BatchTaskColor";
import {
  computeAggregatedArguments,
  getNodeDisplayName,
  getNodeIcon,
  getNodeIconColor,
} from "./utils";

/**
 * Content for multi-selection in the Properties window.
 * Shows list of selected nodes, common argument editing, and Create Subgraph section.
 */
export const MultiSelectionDetails = observer(function MultiSelectionDetails() {
  const { multiSelection } = editorStore;
  const spec = useSpec();
  const { getNodes, getEdges } = useReactFlow();

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

  const handleAutoLayoutSelection = () => {
    if (!spec || multiSelection.length < 2) return;

    const selectedIds = new Set(multiSelection.map((n) => n.id));
    const allNodes = getNodes();
    const allEdges = getEdges();

    const selectedRFNodes = allNodes.filter((n) => selectedIds.has(n.id));
    const connectedEdges = allEdges.filter(
      (e) => selectedIds.has(e.source) || selectedIds.has(e.target),
    );

    const layoutedNodes = autoLayoutNodes(selectedRFNodes, connectedEdges);
    applyAutoLayoutPositions(spec, layoutedNodes);
  };

  if (multiSelection.length === 0) {
    return null;
  }

  return (
    <BlockStack className="h-full bg-white overflow-y-auto">
      <BlockStack gap="4" className="p-3">
        <InlineStack gap="2" blockAlign="center">
          <Icon name="MousePointer2" size="sm" className="text-blue-500" />
          <Text size="sm" weight="semibold" className="text-slate-700">
            {multiSelection.length} nodes selected
          </Text>
        </InlineStack>

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

        {selectedTasks.length > 0 && <BatchTaskColor tasks={resolvedTasks} />}

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

        {multiSelection.length >= 2 && (
          <>
            <Separator />
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-1.5"
              onClick={handleAutoLayoutSelection}
            >
              <Icon name="LayoutDashboard" size="sm" />
              Auto Layout Selection
            </Button>
          </>
        )}

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
