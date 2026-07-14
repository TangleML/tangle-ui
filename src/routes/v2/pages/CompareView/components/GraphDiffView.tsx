import "@xyflow/react/dist/style.css";

import {
  Background,
  Controls,
  NodeToolbar,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useNodesInitialized,
  useNodesState,
  useReactFlow,
} from "@xyflow/react";
import { useEffect, useState } from "react";

import { InfoBox } from "@/components/shared/InfoBox";
import { autoLayoutNodes } from "@/components/shared/ReactFlow/FlowCanvas/utils/autolayout";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import { useAnalytics } from "@/providers/AnalyticsProvider";
import {
  buildMergedGraph,
  type MergedNode,
  type SpotlightMode,
} from "@/routes/v2/pages/CompareView/utils/buildMergedGraph";
import type {
  DiffStatus,
  PipelineComparison,
  TaskDiff,
} from "@/routes/v2/pages/CompareView/utils/comparePipelines";
import { FLOW_CANVAS_DEFAULT_PROPS } from "@/routes/v2/shared/flowCanvasDefaults";
import { tracking } from "@/utils/tracking";

import { DIFF_STATUS_LABELS } from "./DiffStatusBadge";
import { IoDiffDetail } from "./IoDiffDetail";
import { MergedIoNode } from "./MergedIoNode";
import { MergedTaskNode } from "./MergedTaskNode";
import { TaskDiffDetail } from "./TaskDiffDetail";

const taskDisplayName = (diff: TaskDiff) =>
  diff.a?.componentRef.spec?.name ??
  diff.b?.componentRef.spec?.name ??
  diff.taskId;

const NODE_TYPES = { mergedTask: MergedTaskNode, mergedIo: MergedIoNode };

const EDGE_STROKE: Record<DiffStatus, string> = {
  unchanged: "#6b7280",
  lost: "#f87171",
  new: "#22c55e",
  changed: "#f59e0b",
};

const SWATCH: Record<DiffStatus, string> = {
  unchanged: "bg-gray-300",
  lost: "bg-red-400",
  new: "bg-green-500",
  changed: "bg-amber-400",
};

const LEGEND_ORDER: DiffStatus[] = ["new", "lost", "changed", "unchanged"];

const nodeInRun = (status: DiffStatus, run: "a" | "b") =>
  run === "a" ? status !== "new" : status !== "lost";

const edgeInRun = (membership: DiffStatus, run: "a" | "b") =>
  run === "a" ? membership !== "new" : membership !== "lost";

interface GraphDiffViewProps {
  comparison: PipelineComparison;
  nameA: string;
  nameB: string;
  labelA: string;
  labelB: string;
}

export function GraphDiffView({
  comparison,
  nameA,
  nameB,
  labelA,
  labelB,
}: GraphDiffViewProps) {
  if (!comparison.hasComparableGraph) {
    return (
      <InfoBox title="No graph to compare" variant="info" width="full">
        Neither run has a graph pipeline, so there are no tasks to lay out. Use
        the YAML tab to compare the raw specifications.
      </InfoBox>
    );
  }

  return (
    <ReactFlowProvider>
      <MergedGraphCanvas
        comparison={comparison}
        nameA={nameA}
        nameB={nameB}
        labelA={labelA}
        labelB={labelB}
      />
    </ReactFlowProvider>
  );
}

function MergedGraphCanvas({
  comparison,
  nameA,
  nameB,
  labelA,
  labelB,
}: GraphDiffViewProps) {
  const { track } = useAnalytics();

  const { nodes: base, edges: baseEdges } = buildMergedGraph(comparison);

  const [nodes, setNodes, onNodesChange] = useNodesState(base);
  const [spotlight, setSpotlight] = useState<SpotlightMode>("both");
  const [laidOut, setLaidOut] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const selectedNode = selectedNodeId
    ? (base.find((node) => node.id === selectedNodeId) ?? null)
    : null;

  const initialized = useNodesInitialized();
  const { fitView } = useReactFlow();

  useEffect(() => {
    if (initialized && !laidOut) {
      setNodes(
        (current) => autoLayoutNodes(current, baseEdges) as MergedNode[],
      );
      setLaidOut(true);
    }
  }, [initialized, laidOut, baseEdges, setNodes]);

  useEffect(() => {
    if (laidOut) {
      fitView({ padding: 0.2, maxZoom: 1 });
    }
  }, [laidOut, fitView]);

  const displayNodes: MergedNode[] = nodes.map((node) => {
    const dimmed =
      spotlight !== "both" && !nodeInRun(node.data.diff.status, spotlight);
    const style = { ...node.style, opacity: dimmed ? 0.35 : 1 };
    return node.type === "mergedTask"
      ? { ...node, data: { ...node.data, spotlight }, style }
      : { ...node, data: { ...node.data, spotlight }, style };
  });

  const displayEdges = baseEdges.map((edge) => {
    const membership = edge.data?.membership ?? "unchanged";
    const dimmed = spotlight !== "both" && !edgeInRun(membership, spotlight);
    return {
      ...edge,
      style: {
        ...edge.style,
        stroke: EDGE_STROKE[membership],
        strokeWidth: 2,
        opacity: dimmed ? 0.15 : 1,
      },
    };
  });

  const modes: { mode: SpotlightMode; label: string; title: string }[] = [
    { mode: "both", label: "Both", title: "Show both runs" },
    { mode: "a", label: "A", title: `Highlight run A · ${nameA}` },
    { mode: "b", label: "B", title: `Highlight run B · ${nameB}` },
  ];

  return (
    <BlockStack gap="2" className="h-full w-full">
      <InlineStack
        align="space-between"
        blockAlign="center"
        gap="4"
        wrap="wrap"
        className="w-full"
      >
        <InlineStack gap="3" blockAlign="center" wrap="wrap">
          <InlineStack gap="1" blockAlign="center">
            <Text as="span" size="sm" tone="subdued">
              Highlight
            </Text>
            {modes.map(({ mode, label, title }) => (
              <Button
                key={mode}
                size="sm"
                variant={spotlight === mode ? "default" : "outline"}
                aria-pressed={spotlight === mode}
                title={title}
                onClick={() => setSpotlight(mode)}
                {...tracking("compare_runs.graph.highlight", { run: mode })}
              >
                {label}
              </Button>
            ))}
          </InlineStack>
          <Text as="span" size="xs" tone="subdued">
            A · {nameA} — B · {nameB}
          </Text>
        </InlineStack>

        <InlineStack gap="3" blockAlign="center" wrap="wrap">
          {LEGEND_ORDER.map((status) => (
            <InlineStack key={status} gap="1" blockAlign="center">
              <span className={cn("h-2.5 w-2.5 rounded-sm", SWATCH[status])} />
              <Text as="span" size="xs" tone="subdued">
                {DIFF_STATUS_LABELS[status]}
              </Text>
            </InlineStack>
          ))}
        </InlineStack>
      </InlineStack>

      <BlockStack
        gap="0"
        className="min-h-0 w-full flex-1 overflow-hidden rounded-lg border"
      >
        <ReactFlow
          {...FLOW_CANVAS_DEFAULT_PROPS}
          nodes={displayNodes}
          edges={displayEdges}
          nodeTypes={NODE_TYPES}
          onNodesChange={onNodesChange}
          onNodeClick={(_, node) => {
            setSelectedNodeId(node.id);
            track("compare_runs.graph.node.inspect", {
              diff_status: base.find((candidate) => candidate.id === node.id)
                ?.data.diff.status,
            });
          }}
          nodesConnectable={false}
          nodesDraggable={false}
          edgesFocusable={false}
          deleteKeyCode={null}
          onPaneClick={() => setSelectedNodeId(null)}
        >
          <Background />
          <Controls showInteractive={false} />
          <NodeToolbar
            nodeId={selectedNodeId ?? undefined}
            isVisible={selectedNode != null}
            position={Position.Top}
            offset={12}
            className="z-50"
          >
            {selectedNode && (
              <BlockStack
                gap="3"
                className="nowheel nopan max-h-96 w-80 overflow-y-auto overscroll-contain rounded-lg border bg-background p-4 shadow-lg"
              >
                <InlineStack
                  align="space-between"
                  blockAlign="start"
                  gap="2"
                  className="w-full"
                >
                  <Text as="span" size="sm" weight="semibold">
                    {selectedNode.type === "mergedTask"
                      ? taskDisplayName(selectedNode.data.diff)
                      : selectedNode.data.diff.name}
                  </Text>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Close details"
                    onClick={() => setSelectedNodeId(null)}
                    className="-mt-2 -mr-2 size-7 shrink-0"
                    {...tracking("compare_runs.graph.node.close")}
                  >
                    <Icon name="X" size="sm" />
                  </Button>
                </InlineStack>
                {selectedNode.type === "mergedTask" ? (
                  <TaskDiffDetail
                    diff={selectedNode.data.diff}
                    labelA={labelA}
                    labelB={labelB}
                    nameA={nameA}
                    nameB={nameB}
                  />
                ) : (
                  <IoDiffDetail
                    diff={selectedNode.data.diff}
                    labelA={labelA}
                    labelB={labelB}
                  />
                )}
              </BlockStack>
            )}
          </NodeToolbar>
        </ReactFlow>
      </BlockStack>
    </BlockStack>
  );
}
