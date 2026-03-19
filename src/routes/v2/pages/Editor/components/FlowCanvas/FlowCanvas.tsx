import "@/routes/v2/pages/Editor/nodes"; // ensure manifests are registered

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
  type Viewport,
} from "@xyflow/react";
import { observer } from "mobx-react-lite";
import { useEffect, useRef, useState } from "react";

import { BlockStack } from "@/components/ui/layout";
import { cn } from "@/lib/utils";
import type { ComponentSpec } from "@/models/componentSpec";
import { useAutoLayout } from "@/routes/v2/pages/Editor/hooks/useAutoLayout";
import { ZOOM_THRESHOLD } from "@/routes/v2/pages/Editor/nodes/TaskNode/components/TaskNode";
import {
  copySelectedNodes,
  deleteSelectedNodes,
  duplicateSelectedNodes,
  pasteNodes,
} from "@/routes/v2/pages/Editor/store/actions";
import { useCanvasEnhancements } from "@/routes/v2/shared/hooks/useCanvasEnhancements";
import { focusModeStore } from "@/routes/v2/shared/hooks/useFocusMode";
import { useSelectionBehavior } from "@/routes/v2/shared/hooks/useSelectionBehavior";
import { useSpecToNodesEdges } from "@/routes/v2/shared/hooks/useSpecToNodesEdges";
import { NODE_TYPE_REGISTRY } from "@/routes/v2/shared/nodes/registry";
import { CMDALT } from "@/routes/v2/shared/shortcuts/keys";
import {
  clearMultiSelection,
  editorStore,
} from "@/routes/v2/shared/store/editorStore";
import { keyboardStore } from "@/routes/v2/shared/store/keyboardStore";

import { useClipboardShortcuts } from "./hooks/useClipboardShortcuts";
import { useConnectionBehavior } from "./hooks/useConnectionBehavior";
import { useDoubleClickBehavior } from "./hooks/useDoubleClickBehavior";
import { useDropBehavior } from "./hooks/useDropBehavior";
import { useFitViewOnFocus } from "./hooks/useFitViewOnFocus";
import { useNodeEdgeChanges } from "./hooks/useNodeEdgeChanges";
import { usePaneClickBehavior } from "./hooks/usePaneClickBehavior";
import { SelectionToolbar } from "./SelectionToolbar";

const GRID_SIZE = 10;
const MAX_COLLAPSED_SCALE = 7;

const nodeTypes = NODE_TYPE_REGISTRY.getNodeTypes();
const edgeTypes = NODE_TYPE_REGISTRY.getEdgeTypes();

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
  const focusModeActive = focusModeStore.active;

  const metaKeyPressed = keyboardStore.pressed.has(CMDALT);
  const isConnecting = useConnection((c) => c.inProgress);

  const { nodes: specNodes, edges: specEdges } = useSpecToNodesEdges(spec);

  const [nodes, setNodes, rfOnNodesChange] = useNodesState(specNodes);
  const [edges, setEdges, rfOnEdgesChange] = useEdgesState(specEdges);

  const {
    nodes: displayNodes,
    edges: displayEdges,
    onEdgeClick,
  } = useCanvasEnhancements({
    spec,
    nodes,
    edges,
    metaKeyPressed,
    isConnecting,
  });

  useEffect(() => {
    setNodes(specNodes);
    setEdges(specEdges);
  }, [specNodes, specEdges, setNodes, setEdges]);

  useFitViewOnFocus();
  useAutoLayout(spec);
  useClipboardShortcuts(spec, containerRef, reactFlowInstance);

  const selectionBehavior = useSelectionBehavior(spec);
  const nodeEdgeBehavior = useNodeEdgeChanges(
    spec,
    rfOnNodesChange,
    rfOnEdgesChange,
  );
  const connectionBehavior = useConnectionBehavior(spec, reactFlowInstance);
  const dropBehavior = useDropBehavior(spec, reactFlowInstance);
  const doubleClickBehavior = useDoubleClickBehavior(spec);
  const paneClickBehavior = usePaneClickBehavior(spec, reactFlowInstance);

  const handleViewportChange = ({ zoom }: Viewport) => {
    const scale = Math.min(ZOOM_THRESHOLD / zoom, MAX_COLLAPSED_SCALE);
    containerRef.current?.style.setProperty("--collapsed-scale", String(scale));
    containerRef.current?.style.setProperty("--zoom-level", String(zoom));
  };

  return (
    <BlockStack
      ref={containerRef}
      fill
      className={cn(
        "relative",
        focusModeActive && "border-2 border-red-500",
        className,
      )}
    >
      <ReactFlow
        nodes={displayNodes}
        edges={displayEdges}
        {...selectionBehavior}
        {...nodeEdgeBehavior}
        {...connectionBehavior}
        {...dropBehavior}
        {...doubleClickBehavior}
        {...paneClickBehavior}
        onEdgeClick={onEdgeClick}
        onInit={setReactFlowInstance}
        onViewportChange={handleViewportChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        connectionLineComponent={ConnectionLine}
        snapToGrid
        snapGrid={[GRID_SIZE, GRID_SIZE]}
        minZoom={0.1}
        maxZoom={2}
        fitView
        fitViewOptions={{ maxZoom: 1, padding: 0.2 }}
        proOptions={{ hideAttribution: true }}
        deleteKeyCode={["Delete", "Backspace"]}
        selectionOnDrag={false}
        selectionMode={SelectionMode.Partial}
        panOnDrag={true}
        zIndexMode="manual"
      >
        <FloatingSelectionToolbar spec={spec} />
        <Background gap={GRID_SIZE} className="!bg-slate-50" />
        <Controls position="bottom-right" />
        <MiniMap position="bottom-left" pannable zoomable />
      </ReactFlow>
    </BlockStack>
  );
});

const FloatingSelectionToolbar = observer(function FloatingSelectionToolbar({
  spec,
}: {
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
