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
import { useAutoLayout } from "@/routes/v2/pages/Editor/hooks/useAutoLayout";
import {
  FLOW_CANVAS_DEFAULT_PROPS,
  GRID_SIZE,
} from "@/routes/v2/shared/flowCanvasDefaults";
import { useFlowCanvasState } from "@/routes/v2/shared/hooks/useFlowCanvasState";
import { focusModeStore } from "@/routes/v2/shared/hooks/useFocusMode";
import { useViewportScaling } from "@/routes/v2/shared/hooks/useViewportScaling";
import { useNodeRegistry } from "@/routes/v2/shared/nodes/NodeRegistryContext";
import { CMDALT } from "@/routes/v2/shared/shortcuts/keys";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

import { ConnectionLine } from "./components/ConnectionLine";
import { FloatingSelectionToolbar } from "./components/FloatingSelectionToolbar";
import { useClipboardShortcuts } from "./hooks/useClipboardShortcuts";
import { useConnectionBehavior } from "./hooks/useConnectionBehavior";
import { useDoubleClickBehavior } from "./hooks/useDoubleClickBehavior";
import { useDropBehavior } from "./hooks/useDropBehavior";
import { useFitViewOnFocus } from "./hooks/useFitViewOnFocus";
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
  const registry = useNodeRegistry();
  const nodeTypes = registry.getNodeTypes();
  const edgeTypes = registry.getEdgeTypes();
  const { keyboard } = useSharedStores();
  const { containerRef, handleViewportChange } = useViewportScaling();
  const [reactFlowInstance, setReactFlowInstance] =
    useState<ReactFlowInstance | null>(null);
  const focusModeActive = focusModeStore.active;

  const metaKeyPressed = keyboard.pressed.has(CMDALT);
  const isConnecting = useConnection((c) => c.inProgress);

  const {
    displayNodes,
    displayEdges,
    onEdgeClick,
    rfOnNodesChange,
    rfOnEdgesChange,
    selectionBehavior,
  } = useFlowCanvasState({ spec, metaKeyPressed, isConnecting });

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
        "relative",
        focusModeActive && "border-2 border-red-500",
        className,
      )}
    >
      <ReactFlow
        {...FLOW_CANVAS_DEFAULT_PROPS}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
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
        connectionLineComponent={ConnectionLine}
        deleteKeyCode={["Delete", "Backspace"]}
      >
        <FloatingSelectionToolbar spec={spec} />
        <Background gap={GRID_SIZE} className="!bg-slate-50" />
        <Controls position="bottom-right" />
        <MiniMap position="bottom-left" pannable zoomable />
      </ReactFlow>
    </BlockStack>
  );
});
