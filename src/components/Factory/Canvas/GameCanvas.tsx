import {
  Background,
  BackgroundVariant,
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
import { extractResource } from "../utils/string";
import { createOnConnect } from "./callbacks/onConnect";
import { createOnDrop } from "./callbacks/onDrop";
import { ConnectionLine } from "./Edges/ConnectionLine";
import ResourceEdge from "./Edges/ResourceEdge";
import BuildingNode from "./Nodes/Building";

const nodeTypes: Record<string, ComponentType<any>> = {
  building: BuildingNode,
};

const edgeTypes: Record<string, ComponentType<any>> = {
  resourceEdge: ResourceEdge,
};

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

  const onConnect = createOnConnect(setEdges);
  const onDrop = createOnDrop(reactFlowInstance, setNodes);

  const isValidConnection = (connection: Connection | Edge) => {
    if (connection.source === connection.target) return false;

    const sourceResource = extractResource(connection.sourceHandle);
    const targetResource = extractResource(connection.targetHandle);

    if (
      sourceResource !== "any" &&
      targetResource !== "any" &&
      sourceResource !== targetResource
    ) {
      return false;
    }

    const hasExistingConnection = edges.some(
      (edge) =>
        (edge.source === connection.source &&
          edge.sourceHandle === connection.sourceHandle) ||
        (edge.target === connection.target &&
          edge.targetHandle === connection.targetHandle),
    );

    return !hasExistingConnection;
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
        connectionLineComponent={ConnectionLine}
        isValidConnection={isValidConnection}
        deleteKeyCode={["Delete", "Backspace"]}
        proOptions={{ hideAttribution: true }}
        fitView
      >
        <Background variant={BackgroundVariant.Lines} />
        {children}
      </ReactFlow>
    </BlockStack>
  );
};

export default GameCanvas;
