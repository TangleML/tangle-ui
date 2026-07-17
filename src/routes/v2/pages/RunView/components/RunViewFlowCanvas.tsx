import {
  Background,
  MiniMap,
  type NodeChange,
  ReactFlow,
  type ReactFlowProps,
  useReactFlow,
} from "@xyflow/react";
import { observer } from "mobx-react-lite";
import { useState } from "react";

import type { LayoutAlgorithm } from "@/components/shared/ReactFlow/FlowCanvas/utils/autolayout";
import FlowControls from "@/components/shared/ReactFlow/FlowControls/FlowControls";
import { BlockStack } from "@/components/ui/layout";
import { cn } from "@/lib/utils";
import type { ComponentSpec } from "@/models/componentSpec";
import { useAnalytics } from "@/providers/AnalyticsProvider";
import { useCopyShortcut } from "@/routes/v2/pages/RunView/hooks/useCopyShortcut";
import { SubgraphBreadcrumbs } from "@/routes/v2/shared/components/SubgraphBreadcrumbs";
import {
  FLOW_CANVAS_DEFAULT_PROPS,
  GRID_SIZE,
} from "@/routes/v2/shared/flowCanvasDefaults";
import { useAutoLayoutShortcut } from "@/routes/v2/shared/hooks/useAutoLayoutShortcut";
import { useDoubleClickBehavior } from "@/routes/v2/shared/hooks/useDoubleClickBehavior";
import { useFitViewOnFocus } from "@/routes/v2/shared/hooks/useFitViewOnFocus";
import { useFlowCanvasState } from "@/routes/v2/shared/hooks/useFlowCanvasState";
import { useViewportScaling } from "@/routes/v2/shared/hooks/useViewportScaling";
import { useNodeRegistry } from "@/routes/v2/shared/nodes/NodeRegistryContext";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

import { RunViewSelectionToolbar } from "./RunViewSelectionToolbar";

interface RunViewFlowCanvasProps {
  spec: ComponentSpec | null;
  className?: string;
}

export const RunViewFlowCanvas = observer(function RunViewFlowCanvas({
  spec,
  className,
}: RunViewFlowCanvasProps) {
  const { track } = useAnalytics();
  const registry = useNodeRegistry();
  const nodeTypes = registry.getNodeTypes();
  const edgeTypes = registry.getEdgeTypes();
  const { editor, keyboard } = useSharedStores();
  const { containerRef, handleViewportChange } = useViewportScaling();
  const { setNodes: rfSetNodes } = useReactFlow();
  const [flowConfig, setFlowConfig] = useState<ReactFlowProps>({
    nodesDraggable: true,
    selectionOnDrag: false,
    panOnDrag: true,
  });

  const {
    displayNodes,
    displayEdges,
    onEdgeClick,
    rfOnNodesChange,
    selectionBehavior,
  } = useFlowCanvasState({ spec });

  const doubleClickBehavior = useDoubleClickBehavior(spec);
  useCopyShortcut(spec);
  useFitViewOnFocus();

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

  const updateFlowConfig = (config: Partial<ReactFlowProps>) => {
    setFlowConfig((current) => ({ ...current, ...config }));
  };

  const handleAutoLayout = (algorithm: LayoutAlgorithm) => {
    keyboard.invokeShortcut("auto-layout", { algorithm });
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
        {...flowConfig}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        nodes={displayNodes}
        edges={displayEdges}
        onNodesChange={onNodesChange}
        onPaneClick={onPaneClick}
        onEdgeClick={onEdgeClick}
        {...selectionBehavior}
        {...doubleClickBehavior}
        onViewportChange={handleViewportChange}
        nodesConnectable={false}
        elementsSelectable
        deleteKeyCode={null}
        className={cn(flowConfig.selectionOnDrag && "cursor-crosshair")}
      >
        <RunViewSelectionToolbar spec={spec} />
        <Background gap={GRID_SIZE} className="bg-canvas!" />
        <MiniMap
          position="bottom-left"
          className="dark:rounded-md dark:border dark:border-border"
          pannable
          zoomable
          onClick={() => track("v2.run_view.canvas.minimap.click")}
          onNodeClick={() => track("v2.run_view.canvas.minimap.node.click")}
        />
        <FlowControls
          position="bottom-left"
          className="ml-56! mb-3!"
          config={flowConfig}
          updateConfig={updateFlowConfig}
          onAutoLayout={handleAutoLayout}
          showInteractive={false}
          pageType="pipeline_run"
        />
      </ReactFlow>
    </BlockStack>
  );
});
