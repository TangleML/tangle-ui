import {
  Background,
  type Connection,
  Controls,
  type EdgeChange,
  MiniMap,
  type NodeChange,
  type OnConnect,
  type OnSelectionChangeParams,
  ReactFlow,
  type ReactFlowInstance,
  SelectionMode,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";
import type { ComponentType, DragEvent } from "react";
import { useEffect, useRef, useState } from "react";

import { BlockStack } from "@/components/ui/layout";
import { cn } from "@/lib/utils";
import { hydrateComponentReference } from "@/services/componentService";
import type {
  HydratedComponentReference,
  TaskSpec,
} from "@/utils/componentSpec";

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
  updateNodePosition,
} from "../store/actions";
import {
  clearMultiSelection,
  clearSelection,
  type SelectedNode,
  setMultiSelection,
} from "../store/editorStore";
import { IONode } from "./IONode";
import { TaskNode } from "./TaskNode";

const GRID_SIZE = 10;

const nodeTypes: Record<string, ComponentType<any>> = {
  task: TaskNode,
  io: IONode,
};

interface FlowCanvasProps {
  className?: string;
}

export function FlowCanvas({ className }: FlowCanvasProps) {
  const [reactFlowInstance, setReactFlowInstance] =
    useState<ReactFlowInstance | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Get nodes and edges from the spec via valtio
  const { nodes: specNodes, edges: specEdges } = useSpecToNodesEdges();

  // Use ReactFlow's state management for nodes and edges
  const [nodes, setNodes, onNodesChange] = useNodesState(specNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(specEdges);

  // Sync spec changes to ReactFlow state
  useEffect(() => {
    setNodes(specNodes);
    setEdges(specEdges);
  }, [specNodes, specEdges, setNodes, setEdges]);

  const handleSelectionChange = ({
    nodes: selected,
  }: OnSelectionChangeParams) => {
    if (selected.length > 1) {
      // Multi-selection: sync to store
      const multiSelection: SelectedNode[] = selected
        .filter((node) => node.type === "task" || node.type === "io")
        .map((node) => {
          // Determine node type: task nodes have type "task", io nodes need data.ioType
          let nodeType: SelectedNode["type"];
          if (node.type === "task") {
            nodeType = "task";
          } else {
            // io node - check data.ioType
            nodeType = node.data?.ioType === "input" ? "input" : "output";
          }
          return {
            id: node.id,
            type: nodeType,
            position: node.position,
          };
        });
      setMultiSelection(multiSelection);
    } else {
      // Single or no selection - clear multi-selection
      clearMultiSelection();
    }
  };

  const handleNodesChange = (changes: NodeChange[]) => {
    // Handle position changes to update the spec
    const positionChanges = changes.filter(
      (change) => change.type === "position" && change.dragging === false,
    );

    for (const change of positionChanges) {
      if ("id" in change && "position" in change && change.position) {
        updateNodePosition(change.id, change.position);
      }
    }

    // Handle node removal to update the spec
    const removeChanges = changes.filter((change) => change.type === "remove");
    for (const change of removeChanges) {
      if ("id" in change) {
        const nodeId = change.id;
        // Determine node type from entity $id format
        if (nodeId.includes(".tasks_")) {
          deleteTask(nodeId);
        } else if (nodeId.includes(".inputs_")) {
          deleteInput(nodeId);
        } else if (nodeId.includes(".outputs_")) {
          deleteOutput(nodeId);
        }
      }
    }

    onNodesChange(changes);
  };

  const handleEdgesChange = (changes: EdgeChange[]) => {
    // Handle edge removal to update the spec
    const removeChanges = changes.filter((change) => change.type === "remove");
    for (const change of removeChanges) {
      if ("id" in change) {
        deleteEdge(change.id);
      }
    }

    onEdgesChange(changes);
  };

  const handleConnect: OnConnect = (connection: Connection) => {
    if (
      !connection.source ||
      !connection.target ||
      !connection.sourceHandle ||
      !connection.targetHandle
    ) {
      return;
    }

    // Don't allow self-connections
    if (connection.source === connection.target) {
      return;
    }

    connectNodes({
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

    if (!reactFlowInstance) {
      return;
    }

    const droppedData = event.dataTransfer.getData("application/reactflow");
    if (!droppedData) {
      return;
    }

    // Calculate drop position
    const position = reactFlowInstance.screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    });

    try {
      const parsedData = JSON.parse(droppedData);

      if (parsedData.task) {
        // Dropped a task
        const taskSpec = parsedData.task as TaskSpec;
        const componentRef: HydratedComponentReference | null =
          await hydrateComponentReference(taskSpec.componentRef);

        if (componentRef) {
          addTask(componentRef, position);
        }
      } else if (parsedData.input !== undefined) {
        // Dropped an input node
        addInput(position);
      } else if (parsedData.output !== undefined) {
        // Dropped an output node
        addOutput(position);
      }
    } catch (err) {
      console.error("Failed to parse dropped data:", err);
    }
  };

  const handlePaneClick = () => {
    clearSelection();
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
}
