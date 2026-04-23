import { useReactFlow } from "@xyflow/react";
import { observer } from "mobx-react-lite";

import { autoLayoutNodes } from "@/components/shared/ReactFlow/FlowCanvas/utils/autolayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Label } from "@/components/ui/label";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Separator } from "@/components/ui/separator";
import { Text } from "@/components/ui/typography";
import type { Task } from "@/models/componentSpec";
import { CreateSubgraphForm } from "@/routes/v2/pages/Editor/components/CreateSubgraphForm";
import { usePipelineActions } from "@/routes/v2/pages/Editor/store/actions/usePipelineActions";
import { useTaskActions } from "@/routes/v2/pages/Editor/store/actions/useTaskActions";
import { useSpec } from "@/routes/v2/shared/providers/SpecContext";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

import { BatchArgumentRow } from "./components/BatchArgumentRow";
import { BatchTaskColor } from "./components/BatchTaskColor";
import { SelectedNodesList } from "./SelectedNodesList";
import { computeAggregatedArguments } from "./utils";

/**
 * Content for multi-selection in the Properties window.
 * Shows list of selected nodes, common argument editing, and Create Subgraph section.
 */
export const MultiSelectionDetails = observer(function MultiSelectionDetails() {
  const { editor } = useSharedStores();
  const { multiSelection } = editor;
  const spec = useSpec();
  const { getNodes, getEdges } = useReactFlow();
  const { createSubgraph } = usePipelineActions();
  const { applyAutoLayoutPositions } = useTaskActions();

  const selectedTasks = multiSelection.filter((node) => node.type === "task");
  const canCreateSubgraph = selectedTasks.length >= 2;

  const resolvedTasks = spec
    ? selectedTasks
        .map((node) => spec.tasks.find((t) => t.$id === node.id))
        .filter((t): t is Task => t !== undefined)
    : [];

  const aggregatedArgs = computeAggregatedArguments(resolvedTasks);

  const handleCreateSubgraph = (name: string) => {
    if (!canCreateSubgraph || !spec) return;

    const taskIds = selectedTasks.map((node) => node.id);

    const centerX =
      selectedTasks.reduce((sum, node) => sum + node.position.x, 0) /
      selectedTasks.length;
    const centerY =
      selectedTasks.reduce((sum, node) => sum + node.position.y, 0) /
      selectedTasks.length;

    const result = createSubgraph(spec, taskIds, name, {
      x: centerX,
      y: centerY,
    });

    if (result) {
      editor.clearMultiSelection();
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

        <SelectedNodesList nodes={multiSelection} spec={spec} />

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
            <CreateSubgraphForm
              selectedTaskCount={selectedTasks.length}
              onSubmit={handleCreateSubgraph}
            />
          </>
        )}
      </BlockStack>
    </BlockStack>
  );
});
