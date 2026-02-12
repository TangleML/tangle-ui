import {
  type Connection,
  type Edge,
  type Node,
  type OnInit,
  ReactFlow,
  type ReactFlowInstance,
  type ReactFlowProps,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";
import type { ComponentType, DragEvent } from "react";
import { useEffect, useState } from "react";

import { BlockStack } from "@/components/ui/layout";

import { setup } from "../data/setup";
import type { Building } from "../data/types";
import BuildingNode from "./Nodes/Building";

const nodeTypes: Record<string, ComponentType<any>> = {
  building: BuildingNode,
};

const edgeTypes: Record<string, ComponentType<any>> = {
  resourceEdge: () => null, // Will use default edge for now
};

let nodeIdCounter = 0;

const GameCanvas = ({ children, ...rest }: ReactFlowProps) => {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [reactFlowInstance, setReactFlowInstance] =
    useState<ReactFlowInstance>();

  useEffect(() => {
    setNodes(setup.buildings);
  }, [setNodes]);

  const onInit: OnInit = (instance) => {
    setReactFlowInstance(instance);
    instance.fitView({ maxZoom: 1, padding: 0.2 });
  };

  const onConnect = (connection: Connection) => {
    if (connection.source === connection.target) return;

    setEdges((eds) => [
      ...eds,
      {
        ...connection,
        id: `${connection.source}-${connection.target}`,
        type: "resourceEdge",
      } as Edge,
    ]);
  };

  const onNodesDelete = (deleted: Node[]) => {
    console.log("Nodes deleted:", deleted);
  };

  const onEdgesDelete = (deleted: Edge[]) => {
    console.log("Edges deleted:", deleted);
  };

  const onDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();

    if (!reactFlowInstance) return;

    const buildingData = event.dataTransfer.getData("application/reactflow");
    if (!buildingData) return;

    try {
      const { building } = JSON.parse(buildingData) as { building: Building };

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const offsetData = event.dataTransfer.getData("DragStart.offset");
      if (offsetData) {
        const { offsetX, offsetY } = JSON.parse(offsetData);
        position.x -= offsetX;
        position.y -= offsetY;
      }

      const newNode: Node = {
        id: `${building.id}-${nodeIdCounter++}`,
        type: "building",
        position,
        data: {
          ...building,
          label: building.name,
        },
        draggable: true,
        deletable: true,
        selectable: true,
      };

      setNodes((nds) => [...nds, newNode]);
    } catch (error) {
      console.error("Failed to drop building:", error);
    }
  };

  return (
    <BlockStack fill className="relative">
      <ReactFlow
        {...rest}
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodesDelete={onNodesDelete}
        onEdgesDelete={onEdgesDelete}
        onInit={onInit}
        onDragOver={onDragOver}
        onDrop={onDrop}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        minZoom={0.1}
        maxZoom={2}
        deleteKeyCode={["Delete", "Backspace"]}
        proOptions={{ hideAttribution: true }}
        fitView
      >
        {children}
      </ReactFlow>
    </BlockStack>
  );
};

export default GameCanvas;
