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
        onPaneClick={onPaneClick}
        onEdgeClick={onEdgeClick}
        {...selectionBehavior}
        {...doubleClickBehavior}
        onViewportChange={handleViewportChange}
        nodesConnectable={false}
        nodesDraggable
        elementsSelectable
        deleteKeyCode={null}
      >
        <RunViewSelectionToolbar spec={spec} />
        <Background gap={GRID_SIZE} className="!bg-slate-50" />
        <Controls
          position="bottom-right"
          onZoomIn={() => track("v2.run_view.canvas.controls.zoom_in.click")}
          onZoomOut={() => track("v2.run_view.canvas.controls.zoom_out.click")}
          onFitView={() => track("v2.run_view.canvas.controls.fit_view.click")}
          onInteractiveChange={(interactive) =>
            track("v2.run_view.canvas.controls.interactive.toggle", {
              interactive,
            })
          }
        />
        <MiniMap
          position="bottom-left"
          pannable
          zoomable
          onClick={() => track("v2.run_view.canvas.minimap.click")}
          onNodeClick={() => track("v2.run_view.canvas.minimap.node.click")}
        />
      </ReactFlow>
    </BlockStack>
  );
});
