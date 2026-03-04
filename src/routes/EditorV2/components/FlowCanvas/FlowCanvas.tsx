import {
  Background,
  type ConnectionLineComponentProps,
  Controls,
  getBezierPath,
  MiniMap,
  NodeToolbar,
  ReactFlow,
  type ReactFlowInstance,
  SelectionMode,
  useConnection,
  useEdgesState,
  useNodes,
  useNodesState,
  useReactFlow,
} from "@xyflow/react";
import { observer } from "mobx-react-lite";
import type { ComponentType } from "react";
import { useEffect, useRef, useState } from "react";

import { BlockStack } from "@/components/ui/layout";
import { cn } from "@/lib/utils";
import type { ComponentSpec } from "@/models/componentSpec";

import { useGhostNode } from "../../hooks/useGhostNode";
import { useSpecToNodesEdges } from "../../hooks/useSpecToNodesEdges";
import {
  copySelectedNodes,
  deleteSelectedNodes,
  duplicateSelectedNodes,
  pasteNodes,
} from "../../store/actions";
import { clearMultiSelection, editorStore } from "../../store/editorStore";
import { GhostNode } from "../GhostNode";
import { IONode } from "../IONode";
import { SelectionToolbar } from "../SelectionToolbar";
import { TaskNode } from "../TaskNode";
import { useClipboardShortcuts } from "./hooks/useClipboardShortcuts";
import { useConnectionBehavior } from "./hooks/useConnectionBehavior";
import { useDoubleClickBehavior } from "./hooks/useDoubleClickBehavior";
import { useDropBehavior } from "./hooks/useDropBehavior";
import { useFitViewOnFocus } from "./hooks/useFitViewOnFocus";
import { useMetaKey } from "./hooks/useMetaKey";
import { useNodeEdgeChanges } from "./hooks/useNodeEdgeChanges";
import { useSelectionBehavior } from "./hooks/useSelectionBehavior";

const GRID_SIZE = 10;

const nodeTypes: Record<string, ComponentType<any>> = {
  task: TaskNode,
  io: IONode,
  ghost: GhostNode,
};

function ConnectionLine({
  fromX,
  fromY,
  fromPosition,
  toX,
  toY,
  toPosition,
}: ConnectionLineComponentProps) {
  const hasGhost = useNodes().some((n) => n.type === "ghost");
  if (hasGhost) return null;

  const [path] = getBezierPath({
    sourceX: fromX,
    sourceY: fromY,
    sourcePosition: fromPosition,
    targetX: toX,
    targetY: toY,
    targetPosition: toPosition,
  });

  return (
    <g>
      <path
        d={path}
        fill="none"
        stroke="#b1b1b7"
        strokeWidth={1.5}
        className="animated"
      />
    </g>
  );
}

interface FlowCanvasProps {
  spec: ComponentSpec | null;
  className?: string;
}

export const FlowCanvas = observer(function FlowCanvas({
  spec,
  className,
}: FlowCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] =
    useState<ReactFlowInstance | null>(null);

  const { metaKeyPressed, metaKeyPressedRef } = useMetaKey();
  const isConnecting = useConnection((c) => c.inProgress);

  const { ghostNode, ghostEdge } = useGhostNode({
    active: metaKeyPressed,
    isConnecting,
    spec,
  });
  const { nodes: specNodes, edges: specEdges } = useSpecToNodesEdges(spec);

  const [nodes, setNodes, rfOnNodesChange] = useNodesState(specNodes);
  const [edges, setEdges, rfOnEdgesChange] = useEdgesState(specEdges);

  const displayNodes = ghostNode ? [...nodes, ghostNode] : nodes;
  const displayEdges = ghostEdge ? [...edges, ghostEdge] : edges;

  useEffect(() => {
    setNodes(specNodes);
    setEdges(specEdges);
  }, [specNodes, specEdges, setNodes, setEdges]);

  useFitViewOnFocus(reactFlowInstance);
  useClipboardShortcuts(spec, containerRef, reactFlowInstance);

  const selectionBehavior = useSelectionBehavior();
  const nodeEdgeBehavior = useNodeEdgeChanges(
    spec,
    rfOnNodesChange,
    rfOnEdgesChange,
  );
  const connectionBehavior = useConnectionBehavior(
    spec,
    reactFlowInstance,
    metaKeyPressedRef,
  );
  const dropBehavior = useDropBehavior(spec, reactFlowInstance);
  const doubleClickBehavior = useDoubleClickBehavior(spec);

  return (
    <BlockStack ref={containerRef} fill className={cn("relative", className)}>
      <ReactFlow
        nodes={displayNodes}
        edges={displayEdges}
        {...selectionBehavior}
        {...nodeEdgeBehavior}
        {...connectionBehavior}
        {...dropBehavior}
        {...doubleClickBehavior}
        onInit={setReactFlowInstance}
        nodeTypes={nodeTypes}
        connectionLineComponent={ConnectionLine}
        snapToGrid
        snapGrid={[GRID_SIZE, GRID_SIZE]}
        minZoom={0.1}
        maxZoom={2}
        fitView
        fitViewOptions={{ maxZoom: 1, padding: 0.2 }}
        proOptions={{ hideAttribution: true }}
        deleteKeyCode={["Delete", "Backspace"]}
        selectionOnDrag
        selectionMode={SelectionMode.Partial}
        panOnDrag={[1, 2]}
      >
        <FloatingSelectionToolbar spec={spec} />
        <Background gap={GRID_SIZE} className="!bg-slate-50" />
        <Controls position="bottom-right" />
        <MiniMap position="bottom-left" pannable zoomable />
      </ReactFlow>
    </BlockStack>
  );
});

/**
 * Isolated observer component for the selection toolbar.
 * Reads editorStore.multiSelection in its own MobX tracking scope,
 * so FlowCanvas does not re-render when multiSelection changes.
 */
const FloatingSelectionToolbar = observer(function FloatingSelectionToolbar({
  spec,
}: {
  // todo: make ComponentSpec everywhere required, not nullable
  spec: ComponentSpec | null;
}) {
  const { multiSelection } = editorStore;
  const reactFlow = useReactFlow();

  if (multiSelection.length <= 1) return null;

  const nodeIds = multiSelection.map((n) => n.id);

  const handleDuplicate = () => {
    if (!spec) return;
    duplicateSelectedNodes(spec, multiSelection);
  };

  const handleCopy = () => {
    if (!spec) return;
    copySelectedNodes(spec, multiSelection);
  };

  const handlePaste = () => {
    if (!spec) return;
    const viewport = reactFlow.getViewport();
    const centerX = (window.innerWidth / 2 - viewport.x) / viewport.zoom;
    const centerY = (window.innerHeight / 2 - viewport.y) / viewport.zoom;
    pasteNodes(spec, { x: centerX, y: centerY });
  };

  const handleDelete = () => {
    if (!spec) return;
    deleteSelectedNodes(spec, multiSelection);
    clearMultiSelection();
  };

  return (
    <NodeToolbar
      nodeId={nodeIds}
      isVisible
      offset={0}
      align="end"
      className="z-50"
    >
      <SelectionToolbar
        onDuplicate={handleDuplicate}
        onCopy={handleCopy}
        onPaste={handlePaste}
        onDelete={handleDelete}
      />
    </NodeToolbar>
  );
});
