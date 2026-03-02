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
import type { ComponentType, DragEvent } from "react";
import { useEffect, useRef, useState } from "react";

import { BlockStack } from "@/components/ui/layout";
import { cn } from "@/lib/utils";
import type { ComponentReference, ComponentSpec } from "@/models/componentSpec";
import { hydrateComponentReference } from "@/services/componentService";
import type { TaskSpec } from "@/utils/componentSpec";

import type { TaskNodeData } from "../hooks/useSpecToNodesEdges";
import { useSpecToNodesEdges } from "../hooks/useSpecToNodesEdges";
import { executeCommand } from "../store/commandManager";
import {
  AddInputCommand,
  AddOutputCommand,
  AddTaskCommand,
  CompositeCommand,
  ConnectNodesCommand,
  DeleteEdgeCommand,
  DeleteInputCommand,
  DeleteOutputCommand,
  DeleteTaskCommand,
  UpdateNodePositionCommand,
} from "../store/commands";
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
  /** The ComponentSpec to render */
  spec: ComponentSpec | null;
  /** Callback when a task node is double-clicked (for subgraph navigation) */
  onTaskDoubleClick?: (taskEntityId: string) => void;
  className?: string;
}

export function FlowCanvas({
  spec,
  onTaskDoubleClick,
  className,
}: FlowCanvasProps) {
  const [reactFlowInstance, setReactFlowInstance] =
    useState<ReactFlowInstance | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Get nodes and edges from the spec
  // useSpecToNodesEdges uses fingerprint-based caching to return stable references
  const { nodes: specNodes, edges: specEdges } = useSpecToNodesEdges(spec);

  // Use ReactFlow's state management for nodes and edges
  const [nodes, setNodes, onNodesChange] = useNodesState(specNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(specEdges);

  // Sync spec changes to ReactFlow state
  // This runs when spec is mutated (e.g., adding tasks, creating connections)
  // The fingerprint-based caching in useSpecToNodesEdges ensures stable references,
  // so this effect only runs when actual changes occur (not on every render)
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
    if (!spec) {
      onNodesChange(changes);
      return;
    }

    // Handle position changes to update the spec
    const positionChanges = changes.filter(
      (change) => change.type === "position" && change.dragging === false,
    );

    // Batch position changes into a single composite command for multi-select moves
    const positionCommands: UpdateNodePositionCommand[] = [];
    for (const change of positionChanges) {
      if ("id" in change && "position" in change && change.position) {
        positionCommands.push(
          new UpdateNodePositionCommand(spec, change.id, change.position),
        );
      }
    }

    if (positionCommands.length === 1) {
      executeCommand(positionCommands[0]);
    } else if (positionCommands.length > 1) {
      executeCommand(new CompositeCommand(positionCommands, "Move nodes"));
    }

    // Handle node removal to update the spec
    const removeChanges = changes.filter((change) => change.type === "remove");

    // Batch delete changes into a single composite command for multi-select deletes
    const deleteCommands: (
      | DeleteTaskCommand
      | DeleteInputCommand
      | DeleteOutputCommand
    )[] = [];
    for (const change of removeChanges) {
      if ("id" in change) {
        const nodeId = change.id;
        // Determine node type from entity $id format
        if (nodeId.includes(".tasks_")) {
          deleteCommands.push(new DeleteTaskCommand(spec, nodeId));
        } else if (nodeId.includes(".inputs_")) {
          deleteCommands.push(new DeleteInputCommand(spec, nodeId));
        } else if (nodeId.includes(".outputs_")) {
          deleteCommands.push(new DeleteOutputCommand(spec, nodeId));
        }
      }
    }

    if (deleteCommands.length === 1) {
      executeCommand(deleteCommands[0]);
    } else if (deleteCommands.length > 1) {
      executeCommand(new CompositeCommand(deleteCommands, "Delete nodes"));
    }

    onNodesChange(changes);
  };

  const handleEdgesChange = (changes: EdgeChange[]) => {
    if (!spec) {
      onEdgesChange(changes);
      return;
    }

    // Handle edge removal to update the spec
    const removeChanges = changes.filter((change) => change.type === "remove");

    // Batch edge deletes into a single composite command for multi-select deletes
    const deleteCommands: DeleteEdgeCommand[] = [];
    for (const change of removeChanges) {
      if ("id" in change) {
        deleteCommands.push(new DeleteEdgeCommand(spec, change.id));
      }
    }

    if (deleteCommands.length === 1) {
      executeCommand(deleteCommands[0]);
    } else if (deleteCommands.length > 1) {
      executeCommand(
        new CompositeCommand(deleteCommands, "Delete connections"),
      );
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
    ) {
      return;
    }

    // Don't allow self-connections
    if (connection.source === connection.target) {
      return;
    }

    executeCommand(
      new ConnectNodesCommand(spec, {
        sourceNodeId: connection.source,
        sourceHandleId: connection.sourceHandle,
        targetNodeId: connection.target,
        targetHandleId: connection.targetHandle,
      }),
    );
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  };

  const handleDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();

    if (!spec || !reactFlowInstance) {
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
        // Dropped a task - async hydration happens BEFORE command creation
        const taskSpec = parsedData.task as TaskSpec;
        const componentRef = await hydrateComponentReference(
          taskSpec.componentRef,
        );

        if (componentRef) {
          // HydratedComponentReference from utils is structurally compatible with ComponentReference
          executeCommand(
            new AddTaskCommand(
              spec,
              componentRef as ComponentReference,
              position,
            ),
          );
        }
      } else if (parsedData.input !== undefined) {
        // Dropped an input node
        executeCommand(new AddInputCommand(spec, position));
      } else if (parsedData.output !== undefined) {
        // Dropped an output node
        executeCommand(new AddOutputCommand(spec, position));
      }
    } catch (err) {
      console.error("Failed to parse dropped data:", err);
    }
  };

  const handlePaneClick = () => {
    clearSelection();
  };

  /**
   * Handle double-click on nodes.
   * For task nodes, triggers navigation into subgraphs if available.
   */
  const handleNodeDoubleClick: NodeMouseHandler = (
    _event: React.MouseEvent,
    node: Node,
  ) => {
    // Only handle task nodes
    if (node.type !== "task") {
      return;
    }

    const taskData = node.data as TaskNodeData;
    const taskEntityId = taskData.entityId;

    // Notify parent about the double-click (parent handles navigation)
    onTaskDoubleClick?.(taskEntityId);
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
}
