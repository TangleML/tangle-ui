import "@/routes/v2/pages/RunView/nodes";

import {
  Background,
  Controls,
  MiniMap,
  type NodeChange,
  ReactFlow,
  useReactFlow,
} from "@xyflow/react";
import { observer } from "mobx-react-lite";

import { BlockStack } from "@/components/ui/layout";
import { cn } from "@/lib/utils";
import type { ComponentSpec } from "@/models/componentSpec";
import {
  FLOW_CANVAS_DEFAULT_PROPS,
  GRID_SIZE,
} from "@/routes/v2/shared/flowCanvasDefaults";
import { useAutoLayoutShortcut } from "@/routes/v2/shared/hooks/useAutoLayoutShortcut";
import { useFlowCanvasState } from "@/routes/v2/shared/hooks/useFlowCanvasState";
import { useViewportScaling } from "@/routes/v2/shared/hooks/useViewportScaling";
import { NODE_TYPE_REGISTRY } from "@/routes/v2/shared/nodes/registry";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

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
  const { editor } = useSharedStores();
  const { containerRef, handleViewportChange } = useViewportScaling();
  const { setNodes: rfSetNodes } = useReactFlow();

  const {
    displayNodes,
    displayEdges,
    onEdgeClick,
    rfOnNodesChange,
    selectionBehavior,
  } = useFlowCanvasState({ spec });

  const applyLayout = (layoutedNodes: import("@xyflow/react").Node[]) => {
    rfSetNodes(layoutedNodes);
  };
  useAutoLayoutShortcut(applyLayout);

  const onNodesChange = (changes: NodeChange[]) => {
    const filtered = changes.filter(
      (c) => c.type !== "remove" && c.type !== "add",
    );
    rfOnNodesChange(filtered);
  };

  const onPaneClick = () => {
    editor.clearSelection();
  };

  return (
    <BlockStack ref={containerRef} fill className={cn("relative", className)}>
      <ReactFlow
        {...FLOW_CANVAS_DEFAULT_PROPS}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        nodes={displayNodes}
        edges={displayEdges}
        onNodesChange={onNodesChange}
        onPaneClick={onPaneClick}
        onEdgeClick={onEdgeClick}
        {...selectionBehavior}
        onViewportChange={handleViewportChange}
        nodesConnectable={false}
        nodesDraggable
        elementsSelectable
        deleteKeyCode={null}
      >
        <Background gap={GRID_SIZE} className="!bg-slate-50" />
        <Controls position="bottom-right" />
        <MiniMap position="bottom-left" pannable zoomable />
      </ReactFlow>
    </BlockStack>
  );
});
