import "../../EditorV2/nodes";

import {
  Background,
  Controls,
  MiniMap,
  type NodeChange,
  ReactFlow,
  SelectionMode,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Viewport,
} from "@xyflow/react";
import { observer } from "mobx-react-lite";
import { useEffect, useRef, useState } from "react";

import {
  autoLayoutNodes,
  type LayoutAlgorithm,
} from "@/components/shared/ReactFlow/FlowCanvas/utils/autolayout";
import { BlockStack } from "@/components/ui/layout";
import { cn } from "@/lib/utils";
import type { ComponentSpec } from "@/models/componentSpec";

import { useCanvasEnhancements } from "../../EditorV2/components/FlowCanvas/hooks/useCanvasEnhancements";
import { useSelectionBehavior } from "../../EditorV2/components/FlowCanvas/hooks/useSelectionBehavior";
import { useSpecToNodesEdges } from "../../EditorV2/hooks/useSpecToNodesEdges";
import { NODE_TYPE_REGISTRY } from "../../EditorV2/nodes/registry";
import { ZOOM_THRESHOLD } from "../../EditorV2/nodes/TaskNode/components/TaskNode";
import { CMDALT, SHIFT } from "../../EditorV2/shortcuts/keys";
import { clearSelection } from "../../EditorV2/store/editorStore";
import { registerShortcut } from "../../EditorV2/store/keyboardStore";

const GRID_SIZE = 10;
const MAX_COLLAPSED_SCALE = 7;

const nodeTypes = NODE_TYPE_REGISTRY.getNodeTypes();
const edgeTypes = NODE_TYPE_REGISTRY.getEdgeTypes();

interface RunViewFlowCanvasProps {
  spec: ComponentSpec | null;
  className?: string;
}

export const RunViewFlowCanvas = observer(function RunViewFlowCanvas({
  spec,
  className,
}: RunViewFlowCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { getNodes, getEdges, setNodes: rfSetNodes, fitView } = useReactFlow();
  const [isConnecting] = useState(false);

  const { nodes: specNodes, edges: specEdges } = useSpecToNodesEdges(spec);

  const [nodes, setNodes, rfOnNodesChange] = useNodesState(specNodes);
  const [edges, setEdges] = useEdgesState(specEdges);

  const {
    nodes: displayNodes,
    edges: displayEdges,
    onEdgeClick,
  } = useCanvasEnhancements({
    spec,
    nodes,
    edges,
    metaKeyPressed: false,
    isConnecting,
  });

  useEffect(() => {
    setNodes(specNodes);
    setEdges(specEdges);
  }, [specNodes, specEdges, setNodes, setEdges]);

  const selectionBehavior = useSelectionBehavior(spec);

  const onNodesChange = (changes: NodeChange[]) => {
    const filtered = changes.filter(
      (c) => c.type !== "remove" && c.type !== "add",
    );
    rfOnNodesChange(filtered);
  };

  const onPaneClick = () => {
    clearSelection();
  };

  useEffect(() => {
    const handleAutoLayout = (algorithm?: LayoutAlgorithm) => {
      const currentNodes = getNodes();
      const currentEdges = getEdges();
      if (currentNodes.length === 0) return;

      const layoutedNodes = autoLayoutNodes(
        currentNodes,
        currentEdges,
        algorithm,
      );
      rfSetNodes(layoutedNodes);
      requestAnimationFrame(() => {
        fitView({ maxZoom: 1, duration: 300 });
      });
    };

    const unregister = registerShortcut({
      id: "auto-layout",
      keys: [CMDALT, SHIFT, "L"],
      label: "Auto layout",
      action: (_event, params) => {
        handleAutoLayout(params?.algorithm as LayoutAlgorithm | undefined);
      },
    });

    return unregister;
  }, [getNodes, getEdges, rfSetNodes, fitView]);

  const handleViewportChange = ({ zoom }: Viewport) => {
    const scale = Math.min(ZOOM_THRESHOLD / zoom, MAX_COLLAPSED_SCALE);
    containerRef.current?.style.setProperty("--collapsed-scale", String(scale));
    containerRef.current?.style.setProperty("--zoom-level", String(zoom));
  };

  return (
    <BlockStack ref={containerRef} fill className={cn("relative", className)}>
      <ReactFlow
        nodes={displayNodes}
        edges={displayEdges}
        onNodesChange={onNodesChange}
        onPaneClick={onPaneClick}
        onEdgeClick={onEdgeClick}
        {...selectionBehavior}
        onViewportChange={handleViewportChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        nodesConnectable={false}
        nodesDraggable
        elementsSelectable
        deleteKeyCode={null}
        snapToGrid
        snapGrid={[GRID_SIZE, GRID_SIZE]}
        minZoom={0.1}
        maxZoom={2}
        fitView
        fitViewOptions={{ maxZoom: 1, padding: 0.2 }}
        proOptions={{ hideAttribution: true }}
        selectionOnDrag={false}
        selectionMode={SelectionMode.Partial}
        panOnDrag
        zIndexMode="manual"
      >
        <Background gap={GRID_SIZE} className="!bg-slate-50" />
        <Controls position="bottom-right" />
        <MiniMap position="bottom-left" pannable zoomable />
      </ReactFlow>
    </BlockStack>
  );
});
