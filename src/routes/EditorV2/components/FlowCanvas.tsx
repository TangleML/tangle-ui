import {
  Background,
  type Connection,
  Controls,
  type EdgeChange,
  MiniMap,
  type Node,
  type NodeChange,
  type NodeMouseHandler,
  type OnConnect,
  type OnSelectionChangeParams,
  ReactFlow,
  type ReactFlowInstance,
  SelectionMode,
  useEdgesState,
  useNodesState,
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

import type { TaskNodeData } from "../hooks/useSpecToNodesEdges";
import { useSpecToNodesEdges } from "../hooks/useSpecToNodesEdges";
import {
  addInput,
  addOutput,
  addTask,
  connectNodes,
  deleteEdge,
  deleteInput,
  deleteOutput,
  deleteTask,
  getNodeTypeFromId,
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
import { IONode } from "./IONode";
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
};

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

  const { nodes: specNodes, edges: specEdges } = useSpecToNodesEdges(spec);

  const [nodes, setNodes, onNodesChange] = useNodesState(specNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(specEdges);

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

  return (
    <BlockStack ref={containerRef} fill className={cn("relative", className)}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={handleConnect}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onPaneClick={handlePaneClick}
        onInit={setReactFlowInstance}
        onSelectionChange={handleSelectionChange}
        onNodeDoubleClick={handleNodeDoubleClick}
        nodeTypes={nodeTypes}
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
        <Background gap={GRID_SIZE} className="!bg-slate-50" />
        <Controls position="bottom-right" />
        <MiniMap position="bottom-left" pannable zoomable />
      </ReactFlow>
    </BlockStack>
  );
});
