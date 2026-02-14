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
import type { ComponentType } from "react";
import { useState } from "react";

import { BlockStack } from "@/components/ui/layout";

const nodeTypes: Record<string, ComponentType<any>> = {
  building: () => (
    <div className="px-4 py-2 shadow-md rounded-md bg-white border-2 border-stone-400">
      <div className="font-bold">Building</div>
    </div>
  ),
};

const edgeTypes: Record<string, ComponentType<any>> = {
  resourceEdge: () => null, // Will use default edge for now
};

const GameCanvas = ({ children, ...rest }: ReactFlowProps) => {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [reactFlowInstance, setReactFlowInstance] =
    useState<ReactFlowInstance>();

  const onInit: OnInit = (instance) => {
    setReactFlowInstance(instance);
    instance.fitView({ maxZoom: 1 });
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
