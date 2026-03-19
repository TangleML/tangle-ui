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
import { useEffect } from "react";

import {
  autoLayoutNodes,
  type LayoutAlgorithm,
} from "@/components/shared/ReactFlow/FlowCanvas/utils/autolayout";
import { BlockStack } from "@/components/ui/layout";
import { cn } from "@/lib/utils";
import type { ComponentSpec } from "@/models/componentSpec";
import {
  FLOW_CANVAS_DEFAULT_PROPS,
  GRID_SIZE,
} from "@/routes/v2/shared/flowCanvasDefaults";
import { useFlowCanvasState } from "@/routes/v2/shared/hooks/useFlowCanvasState";
import { useViewportScaling } from "@/routes/v2/shared/hooks/useViewportScaling";
import { NODE_TYPE_REGISTRY } from "@/routes/v2/shared/nodes/registry";
import { CMDALT, SHIFT } from "@/routes/v2/shared/shortcuts/keys";
import { clearSelection } from "@/routes/v2/shared/store/editorStore";
import { registerShortcut } from "@/routes/v2/shared/store/keyboardStore";

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
  const { containerRef, handleViewportChange } = useViewportScaling();
  const { getNodes, getEdges, setNodes: rfSetNodes, fitView } = useReactFlow();

  const {
    displayNodes,
    displayEdges,
    onEdgeClick,
    rfOnNodesChange,
    selectionBehavior,
  } = useFlowCanvasState({ spec });

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
