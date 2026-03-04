import {
  Background,
  type Connection,
  type ConnectionLineComponentProps,
  Controls,
  type EdgeChange,
  type FinalConnectionState,
  getBezierPath,
  MiniMap,
  type Node,
  type NodeChange,
  type NodeMouseHandler,
  NodeToolbar,
  type OnConnect,
  type OnSelectionChangeParams,
  ReactFlow,
  type ReactFlowInstance,
  SelectionMode,
  useConnection,
  useEdgesState,
  useNodes,
  useNodesState,
  useReactFlow,
} from "@xyflow/react";
import { observer } from "mobx-react-lite";
import type { ComponentType, DragEvent } from "react";
import { useEffect, useRef, useState } from "react";

import { BlockStack } from "@/components/ui/layout";
import { cn } from "@/lib/utils";
import type { ComponentReference, ComponentSpec } from "@/models/componentSpec";
import { hydrateComponentReference } from "@/services/componentService";
import type { TaskSpec } from "@/utils/componentSpec";
import { debounce } from "@/utils/debounce";

import { useGhostNode } from "../hooks/useGhostNode";
import type { TaskNodeData } from "../hooks/useSpecToNodesEdges";
import { useSpecToNodesEdges } from "../hooks/useSpecToNodesEdges";
import {
  addInput,
  addOutput,
  addTask,
  connectNodes,
  copySelectedNodes,
  createConnectedIONode,
  deleteEdge,
  deleteInput,
  deleteOutput,
  deleteSelectedNodes,
  deleteTask,
  duplicateSelectedNodes,
  findEntityById,
  getNodeTypeFromId,
  pasteNodes,
  updateNodePosition,
} from "../store/actions";
import {
  clearMultiSelection,
  clearSelection,
  editorStore,
  type SelectedNode,
  setMultiSelection,
  setPendingFocusNode,
} from "../store/editorStore";
import { undoStore } from "../store/undoStore";
import {
  GHOST_ESTIMATED_WIDTH,
  GHOST_NODE_ID,
  GHOST_OFFSET_X,
  GHOST_OFFSET_Y,
  GhostNode,
} from "./GhostNode";
import { IONode } from "./IONode";
import { SelectionToolbar } from "./SelectionToolbar";
import { TaskNode } from "./TaskNode";

const GRID_SIZE = 10;
const SELECTION_DEBOUNCE_MS = 150;

function buildMultiSelection(selected: Node[]): SelectedNode[] {
  return selected
    .filter((node) => node.type === "task" || node.type === "io")
    .map((node) => {
      let nodeType: SelectedNode["type"];
      if (node.type === "task") {
        nodeType = "task";
      } else {
        nodeType = node.data?.ioType === "input" ? "input" : "output";
      }
      return { id: node.id, type: nodeType, position: node.position };
    });
}

const debouncedSetMultiSelection = debounce(
  (nodes: SelectedNode[]) => setMultiSelection(nodes),
  SELECTION_DEBOUNCE_MS,
);

const nodeTypes: Record<string, ComponentType<any>> = {
  task: TaskNode,
  io: IONode,
  ghost: GhostNode,
};

/**
 * Returns the current effective selection: multiSelection if multiple nodes
 * are selected, or a single-element array built from selectedNodeId when
 * exactly one node is selected.
 */
function getEffectiveSelection(spec: ComponentSpec): SelectedNode[] {
  const { multiSelection, selectedNodeId, selectedNodeType } = editorStore;
  if (multiSelection.length > 0) return multiSelection;

  if (!selectedNodeId || !selectedNodeType) return [];

  const entity = findEntityById(spec, selectedNodeId);
  if (!entity) return [];

  const position = entity.annotations.get("editor.position");
  return [{ id: selectedNodeId, type: selectedNodeType, position }];
}

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
  onTaskDoubleClick?: (taskEntityId: string) => void;
  className?: string;
}

export const FlowCanvas = observer(function FlowCanvas({
  spec,
  onTaskDoubleClick,
  className,
}: FlowCanvasProps) {
  const [reactFlowInstance, setReactFlowInstance] =
    useState<ReactFlowInstance | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [metaKeyPressed, setMetaKeyPressed] = useState(false);

  const isConnecting = useConnection((connection) => connection.inProgress);

  const metaKeyPressedRef = useRef(false);
  metaKeyPressedRef.current = metaKeyPressed;

  const { ghostNode, ghostEdge } = useGhostNode({
    active: metaKeyPressed,
    isConnecting,
    spec,
  });

  const { nodes: specNodes, edges: specEdges } = useSpecToNodesEdges(spec);

  const [nodes, setNodes, onNodesChange] = useNodesState(specNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(specEdges);

  const displayNodes = ghostNode ? [...nodes, ghostNode] : nodes;
  const displayEdges = ghostEdge ? [...edges, ghostEdge] : edges;

  useEffect(() => {
    setNodes(specNodes);
    setEdges(specEdges);
  }, [specNodes, specEdges, setNodes, setEdges]);

  const pendingFocusNodeId = editorStore.pendingFocusNodeId;

  useEffect(() => {
    if (!pendingFocusNodeId || !reactFlowInstance) return;

    const timer = setTimeout(async () => {
      await reactFlowInstance.fitView({
        nodes: [{ id: pendingFocusNodeId }],
        maxZoom: 1,
        duration: 300,
      });
      setPendingFocusNode(null);
    }, 50);

    return () => clearTimeout(timer);
  }, [pendingFocusNodeId, reactFlowInstance]);

  useEffect(() => {
    return () => debouncedSetMultiSelection.cancel();
  }, []);

  const handleSelectionChange = ({
    nodes: selected,
  }: OnSelectionChangeParams) => {
    if (selected.length > 1) {
      debouncedSetMultiSelection(buildMultiSelection(selected));
    } else {
      debouncedSetMultiSelection.cancel();
      clearMultiSelection();
    }
  };

  const handleNodesChange = (changes: NodeChange[]) => {
    if (!spec) {
      onNodesChange(changes);
      return;
    }

    const positionChanges = changes.filter(
      (change) => change.type === "position" && change.dragging === false,
    );

    if (positionChanges.length > 0) {
      undoStore.undoManager?.withGroup("Move nodes", () => {
        for (const change of positionChanges) {
          // todo: introduce type guard for change isPositionChange
          if ("id" in change && "position" in change && change.position) {
            updateNodePosition(spec, change.id, change.position);
          }
        }
      });
    }

    const removeChanges = changes.filter((change) => change.type === "remove");
    for (const change of removeChanges) {
      // todo: introduce type guard for change isRemoveChange
      if ("id" in change) {
        const nodeId = change.id;
        const nodeType = getNodeTypeFromId(nodeId);

        // todo: better handling of node types, remove if statements
        if (nodeType === "task") deleteTask(spec, nodeId);
        else if (nodeType === "input") deleteInput(spec, nodeId);
        else if (nodeType === "output") deleteOutput(spec, nodeId);
      }
    }

    onNodesChange(changes);
  };

  const handleEdgesChange = (changes: EdgeChange[]) => {
    if (!spec) {
      onEdgesChange(changes);
      return;
    }

    const removeChanges = changes.filter((change) => change.type === "remove");
    for (const change of removeChanges) {
      // todo: introduce type guard for change isRemoveChange
      if ("id" in change) {
        deleteEdge(spec, change.id);
      }
    }

    onEdgesChange(changes);
  };

  const handleConnect: OnConnect = (connection: Connection) => {
    if (!spec) return;
    if (
      !connection.source ||
      !connection.target ||
      !connection.sourceHandle ||
      !connection.targetHandle
    )
      return;
    if (connection.source === connection.target) return;

    connectNodes(spec, {
      sourceNodeId: connection.source,
      sourceHandleId: connection.sourceHandle,
      targetNodeId: connection.target,
      targetHandleId: connection.targetHandle,
    });
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  };

  const handleDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!spec || !reactFlowInstance) return;

    const droppedData = event.dataTransfer.getData("application/reactflow");
    if (!droppedData) return;

    const position = reactFlowInstance.screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    });

    try {
      const parsedData = JSON.parse(droppedData);

      // todo: introduce better handling of node types, remove if statements, make it SOLID
      if (parsedData.task) {
        const taskSpec = parsedData.task as TaskSpec;
        const componentRef = await hydrateComponentReference(
          taskSpec.componentRef,
        );
        if (componentRef) {
          addTask(spec, componentRef as ComponentReference, position);
        }
      } else if (parsedData.input !== undefined) {
        addInput(spec, position);
      } else if (parsedData.output !== undefined) {
        addOutput(spec, position);
      }
    } catch (err) {
      console.error("Failed to parse dropped data:", err);
    }
  };

  const handlePaneClick = () => {
    clearSelection();
  };

  const handleNodeDoubleClick: NodeMouseHandler = (
    _event: React.MouseEvent,
    node: Node,
  ) => {
    if (node.type !== "task") return;
    const taskData = node.data as TaskNodeData;
    onTaskDoubleClick?.(taskData.entityId);
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Meta" || e.key === "Control") {
        setMetaKeyPressed(true);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Meta" || e.key === "Control") {
        setMetaKeyPressed(false);
      }
    };
    const onBlur = () => setMetaKeyPressed(false);

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  useEffect(() => {
    // todo: introduce hotkey manager for central handling of hotkeys
    const onKeyDown = (e: KeyboardEvent) => {
      if (!spec) return;

      const isModKey = e.metaKey || e.ctrlKey;
      const target = e.target as HTMLElement;
      const isInputFocused =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      if (isInputFocused || !isModKey) return;

      const selection = getEffectiveSelection(spec);

      if (e.key === "d") {
        e.preventDefault();
        if (selection.length > 0) duplicateSelectedNodes(spec, selection);
      } else if (e.key === "c") {
        e.preventDefault();
        if (selection.length > 0) copySelectedNodes(spec, selection);
      } else if (e.key === "v") {
        e.preventDefault();
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect && reactFlowInstance) {
          const center = reactFlowInstance.screenToFlowPosition({
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
          });
          pasteNodes(spec, center);
        }
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  });

  const handleConnectEnd = (
    event: MouseEvent | TouchEvent,
    connectionState: FinalConnectionState,
  ) => {
    if (!spec || !reactFlowInstance) return;
    if (!metaKeyPressedRef.current) return;

    const isGhostTarget = connectionState.toHandle?.nodeId === GHOST_NODE_ID;
    if (connectionState.isValid && !isGhostTarget) return;

    const fromHandle = connectionState.fromHandle;
    const fromNode = connectionState.fromNode;

    if (!fromHandle?.id || !fromNode || fromNode.type !== "task") return;
    if (fromHandle.type !== "source" && fromHandle.type !== "target") return;

    if (!(event instanceof MouseEvent)) return;

    const cursorFlowPos = reactFlowInstance.screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    });

    const ioType: "input" | "output" =
      fromHandle.type === "target" ? "input" : "output";

    const position = {
      x:
        ioType === "input"
          ? cursorFlowPos.x + GHOST_OFFSET_X - GHOST_ESTIMATED_WIDTH
          : cursorFlowPos.x + GHOST_OFFSET_X,
      y: cursorFlowPos.y + GHOST_OFFSET_Y,
    };

    createConnectedIONode(
      spec,
      fromHandle.nodeId,
      fromHandle.id,
      position,
      ioType,
    );
  };

  return (
    <BlockStack ref={containerRef} fill className={cn("relative", className)}>
      <ReactFlow
        nodes={displayNodes}
        edges={displayEdges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={handleConnect}
        onConnectEnd={handleConnectEnd}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onPaneClick={handlePaneClick}
        onInit={setReactFlowInstance}
        onSelectionChange={handleSelectionChange}
        onNodeDoubleClick={handleNodeDoubleClick}
        nodeTypes={nodeTypes}
        connectionLineComponent={ConnectionLine}
        snapToGrid
        snapGrid={[GRID_SIZE, GRID_SIZE]}
        minZoom={0.1}
        maxZoom={2}
        fitView
        fitViewOptions={{ maxZoom: 1, padding: 0.2 }}
        proOptions={{ hideAttribution: true }}
        deleteKeyCode={["Delete", "Backspace"]}
        selectionOnDrag
        selectionMode={SelectionMode.Partial}
        panOnDrag={[1, 2]}
      >
        <FloatingSelectionToolbar spec={spec} />
        <Background gap={GRID_SIZE} className="!bg-slate-50" />
        <Controls position="bottom-right" />
        <MiniMap position="bottom-left" pannable zoomable />
      </ReactFlow>
    </BlockStack>
  );
});

/**
 * Isolated observer component for the selection toolbar.
 * Reads editorStore.multiSelection in its own MobX tracking scope,
 * so FlowCanvas does not re-render when multiSelection changes.
 */
const FloatingSelectionToolbar = observer(function FloatingSelectionToolbar({
  spec,
}: {
  // todo: make ComponentSpec everywhere required, not nullable
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
