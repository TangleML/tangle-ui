import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  type ReactFlowInstance,
  useConnection,
} from "@xyflow/react";
import { observer } from "mobx-react-lite";
import { useState } from "react";

import { BlockStack } from "@/components/ui/layout";
import { cn } from "@/lib/utils";
import type { ComponentSpec } from "@/models/componentSpec";
import { useAnalytics } from "@/providers/AnalyticsProvider";
import { useAutoLayout } from "@/routes/v2/pages/Editor/hooks/useAutoLayout";
import { ReconcileModeController } from "@/routes/v2/pages/Editor/lineage/ReconcileModeController";
import { reconcileModeStore } from "@/routes/v2/pages/Editor/lineage/reconcileModeStore";
import { SubgraphBreadcrumbs } from "@/routes/v2/shared/components/SubgraphBreadcrumbs";
import { FLOW_CANVAS_DEFAULT_PROPS } from "@/routes/v2/shared/flowCanvasDefaults";
import { useDoubleClickBehavior } from "@/routes/v2/shared/hooks/useDoubleClickBehavior";
import { useFitViewOnFocus } from "@/routes/v2/shared/hooks/useFitViewOnFocus";
import { useFlowCanvasState } from "@/routes/v2/shared/hooks/useFlowCanvasState";
import { focusModeStore } from "@/routes/v2/shared/hooks/useFocusMode";
import { useIsDetailedView } from "@/routes/v2/shared/hooks/useIsDetailedView";
import { useViewportScaling } from "@/routes/v2/shared/hooks/useViewportScaling";
import { useNodeRegistry } from "@/routes/v2/shared/nodes/NodeRegistryContext";
import { CMDALT, SHIFT } from "@/routes/v2/shared/shortcuts/keys";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

import { CanvasUndoRedo } from "./components/CanvasUndoRedo";
import { ConnectionLine } from "./components/ConnectionLine";
import { FloatingSelectionToolbar } from "./components/FloatingSelectionToolbar";
import { useClipboardShortcuts } from "./hooks/useClipboardShortcuts";
import { useConnectionBehavior } from "./hooks/useConnectionBehavior";
import { useDropBehavior } from "./hooks/useDropBehavior";
import { useFlowCanvasOnBeforeDelete } from "./hooks/useFlowCanvasOnBeforeDelete";
import { useNodeEdgeChanges } from "./hooks/useNodeEdgeChanges";
import { usePaneClickBehavior } from "./hooks/usePaneClickBehavior";

interface FlowCanvasProps {
  spec: ComponentSpec | null;
  className?: string;
}

export const FlowCanvas = observer(function FlowCanvas({
  spec,
  className,
}: FlowCanvasProps) {
  const { track } = useAnalytics();
  const registry = useNodeRegistry();
  const nodeTypes = registry.getNodeTypes();
  const edgeTypes = registry.getEdgeTypes();
  const { keyboard } = useSharedStores();
  const { containerRef, handleViewportChange } = useViewportScaling();
  const [reactFlowInstance, setReactFlowInstance] =
    useState<ReactFlowInstance | null>(null);
  const focusModeActive = focusModeStore.active;

  const metaKeyPressed = keyboard.pressed.has(CMDALT);
  const shiftKeyPressed = keyboard.pressed.has(SHIFT);
  const isConnecting = useConnection((c) => c.inProgress);
  const isDetailedView = useIsDetailedView();

  const {
    displayNodes: rawDisplayNodes,
    displayEdges,
    onEdgeClick,
    rfOnNodesChange,
    rfOnEdgesChange,
    selectionBehavior: rawSelectionBehavior,
  } = useFlowCanvasState({ spec, metaKeyPressed, isConnecting });

  // During reconcile mode: boost the current task's zIndex above all others so
  // it's always visible regardless of user-set stacking order, and lock canvas
  // selection to that task so clicks don't shift the blue ring elsewhere.
  const reconcileTaskId = reconcileModeStore.currentReconcileTaskId;
  const isReconciling = reconcileModeStore.active;

  const displayNodes = reconcileTaskId
    ? rawDisplayNodes.map((n) =>
        n.id === reconcileTaskId ? { ...n, zIndex: 10000 } : n,
      )
    : rawDisplayNodes;

  const selectionBehavior = isReconciling
    ? { ...rawSelectionBehavior, onSelectionChange: () => {} }
    : rawSelectionBehavior;

  const onBeforeDelete = useFlowCanvasOnBeforeDelete(spec);

  useFitViewOnFocus();
  useAutoLayout(spec);
  useClipboardShortcuts(spec, containerRef, reactFlowInstance);

  const nodeEdgeBehavior = useNodeEdgeChanges(
    spec,
    rfOnNodesChange,
    rfOnEdgesChange,
  );
  const connectionBehavior = useConnectionBehavior(spec, reactFlowInstance);
  const dropBehavior = useDropBehavior(spec, reactFlowInstance);
  const doubleClickBehavior = useDoubleClickBehavior(spec);
  const paneClickBehavior = usePaneClickBehavior(spec, reactFlowInstance);

  return (
    <BlockStack
      ref={containerRef}
      fill
      className={cn(
        "relative select-none",
        focusModeActive && "ring-2 ring-blue-500",
        className,
      )}
    >
      <SubgraphBreadcrumbs />
      <ReactFlow
        {...FLOW_CANVAS_DEFAULT_PROPS}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        nodes={displayNodes}
        edges={displayEdges}
        nodesConnectable={isDetailedView}
        edgesReconnectable={isDetailedView}
        {...selectionBehavior}
        {...nodeEdgeBehavior}
        {...connectionBehavior}
        {...dropBehavior}
        {...doubleClickBehavior}
        {...paneClickBehavior}
        onEdgeClick={onEdgeClick}
        onInit={setReactFlowInstance}
        onViewportChange={handleViewportChange}
        onBeforeDelete={onBeforeDelete}
        connectionLineComponent={ConnectionLine}
        deleteKeyCode={isReconciling ? null : ["Delete", "Backspace"]}
        className={cn(
          shiftKeyPressed && !isConnecting && "cursor-crosshair",
          !isDetailedView && "connections-disabled",
        )}
      >
        <FloatingSelectionToolbar spec={spec} />
        <ReconcileModeController />
        <Background gap={10} className="bg-slate-50!" />
        <Controls
          position="bottom-right"
          onZoomIn={() => track("v2.pipeline_canvas.controls.zoom_in.click")}
          onZoomOut={() => track("v2.pipeline_canvas.controls.zoom_out.click")}
          onFitView={() => track("v2.pipeline_canvas.controls.fit_view.click")}
          onInteractiveChange={(interactive) =>
            track("v2.pipeline_canvas.controls.interactive.toggle", {
              interactive,
            })
          }
        />
        <MiniMap
          position="bottom-left"
          pannable
          zoomable
          onClick={() => track("v2.pipeline_canvas.minimap.click")}
          onNodeClick={() => track("v2.pipeline_canvas.minimap.node.click")}
        />
      </ReactFlow>
      <CanvasUndoRedo />
    </BlockStack>
  );
});
