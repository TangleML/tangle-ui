import {
  Background,
  type Edge,
  type Node,
  ReactFlow,
  type ReactFlowInstance,
  useConnection,
  type XYPosition,
} from "@xyflow/react";
import { observer } from "mobx-react-lite";
import { useState } from "react";

import { buildHandleBoundsMap } from "@/components/shared/ReactFlow/FlowCanvas/utils/autolayout";
import { useFlagValue } from "@/components/shared/Settings/useFlags";
import { BlockStack } from "@/components/ui/layout";
import { cn } from "@/lib/utils";
import type { ComponentSpec } from "@/models/componentSpec";
import { useAutoLayout } from "@/routes/v2/pages/Editor/hooks/useAutoLayout";
import { useEmbeddedInputConnectionActions } from "@/routes/v2/pages/Editor/hooks/useEmbeddedInputConnectionActions";
import { SubgraphBreadcrumbs } from "@/routes/v2/shared/components/SubgraphBreadcrumbs";
import { FLOW_CANVAS_DEFAULT_PROPS } from "@/routes/v2/shared/flowCanvasDefaults";
import { useDoubleClickBehavior } from "@/routes/v2/shared/hooks/useDoubleClickBehavior";
import { useFitViewOnFocus } from "@/routes/v2/shared/hooks/useFitViewOnFocus";
import { useFitViewOnRequest } from "@/routes/v2/shared/hooks/useFitViewOnRequest";
import { useFlowCanvasState } from "@/routes/v2/shared/hooks/useFlowCanvasState";
import { focusModeStore } from "@/routes/v2/shared/hooks/useFocusMode";
import { useIsDetailedView } from "@/routes/v2/shared/hooks/useIsDetailedView";
import { useViewportScaling } from "@/routes/v2/shared/hooks/useViewportScaling";
import { AvoidNodesEdge } from "@/routes/v2/shared/nodes/edges/AvoidNodesEdge/AvoidNodesEdge";
import { planConduitRoutes } from "@/routes/v2/shared/nodes/edges/AvoidNodesEdge/conduitLanes";
import { deriveVirtualConduitGuidelines } from "@/routes/v2/shared/nodes/edges/AvoidNodesEdge/virtualConduits";
import { useNodeRegistry } from "@/routes/v2/shared/nodes/NodeRegistryContext";
import { InputConnectionActionsProvider } from "@/routes/v2/shared/nodes/TaskNode/InputConnectionActionsContext";
import { VirtualConduitsOverlay } from "@/routes/v2/shared/overlays/virtualConduits/VirtualConduitsOverlay";
import { CMD_OR_CTRL, SHIFT } from "@/routes/v2/shared/shortcuts/keys";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";
import { TASK_COLOR_ANNOTATION } from "@/utils/annotations";

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

/** Default opacity applied to edges originating from input nodes. */
const DIMMED_INPUT_EDGE_OPACITY = 0.35;

interface InputEdgeTransformContext {
  inputNodeIds: ReadonlySet<string>;
  selectedNodeIds: ReadonlySet<string>;
  routes: Map<string, XYPosition[]>;
  sourceColorById: ReadonlyMap<string, string>;
}

/**
 * Re-types a `conduitEdge` to the node-avoiding edge, attaches its precomputed
 * lane route, tints it with the source task's color, and dims it when it
 * originates from an input node (unless the edge or a connected node is
 * selected). Non-conduit edges pass through unchanged.
 *
 * Manual (user-assigned) conduit guidelines keep their explicit routing; every
 * other edge carries `routePoints` so `AvoidNodesEdge` draws the deterministic
 * lane polyline.
 */
function transformInputEdge(
  edge: Edge,
  {
    inputNodeIds,
    selectedNodeIds,
    routes,
    sourceColorById,
  }: InputEdgeTransformContext,
): Edge {
  if (edge.type !== "conduitEdge") return edge;

  const manual = edge.data?.guidelines;
  const hasManual = Array.isArray(manual) && manual.length > 0;
  const guidelines = hasManual ? manual : [];
  const routePoints = hasManual ? undefined : routes.get(edge.id);

  const isActive =
    edge.selected ||
    selectedNodeIds.has(edge.source) ||
    selectedNodeIds.has(edge.target);
  const dimmed = inputNodeIds.has(edge.source) && !isActive;

  const existingColor =
    typeof edge.data?.conduitColor === "string"
      ? edge.data.conduitColor
      : undefined;
  const sourceColor = sourceColorById.get(edge.source);
  const conduitColor = hasManual
    ? existingColor
    : (sourceColor ?? existingColor);

  return {
    ...edge,
    type: "avoidNodesEdge",
    data: { ...edge.data, guidelines, routePoints, conduitColor },
    style: dimmed
      ? { ...edge.style, opacity: DIMMED_INPUT_EDGE_OPACITY }
      : edge.style,
  };
}

/** Map each task node id to its editor color, skipping the transparent default. */
function buildSourceColorMap(spec: ComponentSpec | null): Map<string, string> {
  const map = new Map<string, string>();
  if (!spec) return map;
  for (const task of spec.tasks) {
    const color = task.annotations.get(TASK_COLOR_ANNOTATION);
    if (typeof color === "string" && color && color !== "transparent") {
      map.set(task.$id, color);
    }
  }
  return map;
}

function collectNodeIds(
  nodes: Node[],
  predicate: (node: Node) => boolean,
): Set<string> {
  const ids = new Set<string>();
  for (const node of nodes) {
    if (predicate(node)) ids.add(node.id);
  }
  return ids;
}

export const FlowCanvas = observer(function FlowCanvas({
  spec,
  className,
}: FlowCanvasProps) {
  const registry = useNodeRegistry();
  const nodeTypes = registry.getNodeTypes();
  const avoidNodesEnabled = useFlagValue("avoid-nodes-edges");
  const edgeTypes = avoidNodesEnabled
    ? { ...registry.getEdgeTypes(), avoidNodesEdge: AvoidNodesEdge }
    : registry.getEdgeTypes();
  const { keyboard, editor } = useSharedStores();
  const { containerRef, handleViewportChange } = useViewportScaling();
  const [reactFlowInstance, setReactFlowInstance] =
    useState<ReactFlowInstance | null>(null);
  const focusModeActive = focusModeStore.active;

  const metaKeyPressed = keyboard.pressed.has(CMD_OR_CTRL);
  const shiftKeyPressed = keyboard.pressed.has(SHIFT);
  const isConnecting = useConnection((c) => c.inProgress);
  const isDetailedView = useIsDetailedView();

  const {
    displayNodes,
    displayEdges,
    onEdgeClick,
    rfOnNodesChange,
    rfOnEdgesChange,
    selectionBehavior,
  } = useFlowCanvasState({ spec, metaKeyPressed, isConnecting });

  const handleBounds = reactFlowInstance
    ? buildHandleBoundsMap(
        displayNodes.map((node) => node.id),
        reactFlowInstance.getInternalNode,
      )
    : undefined;

  const virtualGuidelines = avoidNodesEnabled
    ? deriveVirtualConduitGuidelines(displayNodes, displayEdges, handleBounds)
    : null;

  const routes = avoidNodesEnabled
    ? planConduitRoutes(displayNodes, displayEdges, handleBounds)
    : null;

  const inputNodeIds = avoidNodesEnabled
    ? collectNodeIds(
        displayNodes,
        (node) => node.type === "input" || node.type === "inputCluster",
      )
    : new Set<string>();
  const selectedNodeIds = avoidNodesEnabled
    ? collectNodeIds(displayNodes, (node) => node.selected === true)
    : new Set<string>();
  const sourceColorById = avoidNodesEnabled
    ? buildSourceColorMap(spec)
    : new Map<string, string>();

  const edges =
    avoidNodesEnabled && routes
      ? displayEdges.map((edge) =>
          transformInputEdge(edge, {
            inputNodeIds,
            selectedNodeIds,
            routes,
            sourceColorById,
          }),
        )
      : displayEdges;

  const onBeforeDelete = useFlowCanvasOnBeforeDelete(spec);

  useFitViewOnFocus();
  useFitViewOnRequest();
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
  const inputConnectionActions = useEmbeddedInputConnectionActions(spec);

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
      <InputConnectionActionsProvider value={inputConnectionActions}>
        <ReactFlow
          {...FLOW_CANVAS_DEFAULT_PROPS}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          nodes={displayNodes}
          edges={edges}
          nodesConnectable={isDetailedView}
          edgesReconnectable={isDetailedView}
          {...selectionBehavior}
          {...nodeEdgeBehavior}
          {...connectionBehavior}
          {...dropBehavior}
          {...doubleClickBehavior}
          {...paneClickBehavior}
          onEdgeClick={onEdgeClick}
          onPointerDownCapture={() => editor.setDraggedSincePointerDown(false)}
          onNodeDragStart={() => editor.setDraggedSincePointerDown(true)}
          onNodeClick={() => editor.requestContextPanelReveal()}
          onInit={setReactFlowInstance}
          onViewportChange={handleViewportChange}
          onBeforeDelete={onBeforeDelete}
          connectionLineComponent={ConnectionLine}
          deleteKeyCode={["Delete", "Backspace"]}
          className={cn(
            shiftKeyPressed && !isConnecting && "cursor-crosshair",
            !isDetailedView && "connections-disabled",
          )}
        >
          <FloatingSelectionToolbar spec={spec} />
          <VirtualConduitsOverlay
            guidelines={virtualGuidelines ?? new Map()}
            nodes={displayNodes}
            edges={displayEdges}
          />
          <Background gap={10} className="bg-canvas!" />
        </ReactFlow>
      </InputConnectionActionsProvider>
      <CanvasUndoRedo />
    </BlockStack>
  );
});
