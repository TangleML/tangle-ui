import {
  Background,
  type NodeChange,
  ReactFlow,
  useReactFlow,
} from "@xyflow/react";
import { observer } from "mobx-react-lite";
import type { ReactNode } from "react";

import { BlockStack } from "@/components/ui/layout";
import { cn } from "@/lib/utils";
import type { ComponentSpec } from "@/models/componentSpec";
import { SubgraphBreadcrumbs } from "@/routes/v2/shared/components/SubgraphBreadcrumbs";
import {
  FLOW_CANVAS_DEFAULT_PROPS,
  GRID_SIZE,
} from "@/routes/v2/shared/flowCanvasDefaults";
import { useAutoLayoutShortcut } from "@/routes/v2/shared/hooks/useAutoLayoutShortcut";
import { useCopyShortcut } from "@/routes/v2/shared/hooks/useCopyShortcut";
import { useDoubleClickBehavior } from "@/routes/v2/shared/hooks/useDoubleClickBehavior";
import { useFitViewOnFocus } from "@/routes/v2/shared/hooks/useFitViewOnFocus";
import { useFlowCanvasState } from "@/routes/v2/shared/hooks/useFlowCanvasState";
import { useLayoutUnplacedSpec } from "@/routes/v2/shared/hooks/useLayoutUnplacedSpec";
import { useViewportScaling } from "@/routes/v2/shared/hooks/useViewportScaling";
import { useNodeRegistry } from "@/routes/v2/shared/nodes/NodeRegistryContext";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

interface ReadOnlyFlowCanvasProps {
  spec: ComponentSpec | null;
  className?: string;
  nodesDraggable?: boolean;
  children?: ReactNode;
}

export const ReadOnlyFlowCanvas = observer(function ReadOnlyFlowCanvas({
  spec,
  className,
  nodesDraggable = true,
  children,
}: ReadOnlyFlowCanvasProps) {
  const registry = useNodeRegistry();
  const nodeTypes = registry.getNodeTypes();
  const edgeTypes = registry.getEdgeTypes();
  const { editor } = useSharedStores();
  const { containerRef, handleViewportChange } = useViewportScaling();
  const { setNodes: rfSetNodes } = useReactFlow();

  const {
    displayNodes,
    displayEdges,
    onEdgeClick,
    rfOnNodesChange,
    rfOnEdgesChange,
    selectionBehavior,
  } = useFlowCanvasState({ spec });

  const doubleClickBehavior = useDoubleClickBehavior(spec);
  useCopyShortcut(spec);
  useFitViewOnFocus();

  useAutoLayoutShortcut(rfSetNodes);
  useLayoutUnplacedSpec(spec);

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
    <BlockStack
      ref={containerRef}
      fill
      className={cn("relative select-none", className)}
    >
      <SubgraphBreadcrumbs />
      <ReactFlow
        {...FLOW_CANVAS_DEFAULT_PROPS}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        nodes={displayNodes}
        edges={displayEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={rfOnEdgesChange}
        onPaneClick={onPaneClick}
        onEdgeClick={onEdgeClick}
        onPointerDownCapture={() => editor.setDraggedSincePointerDown(false)}
        onNodeDragStart={() => editor.setDraggedSincePointerDown(true)}
        onNodeClick={() => editor.requestContextPanelReveal()}
        {...selectionBehavior}
        {...doubleClickBehavior}
        onViewportChange={handleViewportChange}
        nodesConnectable={false}
        edgesReconnectable={false}
        nodesDraggable={nodesDraggable}
        elementsSelectable
        deleteKeyCode={null}
      >
        {children}
        <Background gap={GRID_SIZE} className="bg-canvas!" />
      </ReactFlow>
    </BlockStack>
  );
});
