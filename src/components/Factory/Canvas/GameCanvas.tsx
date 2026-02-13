import {
  Background,
  BackgroundVariant,
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
import { useEffect, useRef, useState } from "react";

import { BlockStack } from "@/components/ui/layout";

import type { GlobalResources } from "../data/resources";
import { setup } from "../data/setup";
import { createBuildingNode } from "../objects/buildings/createBuildingNode";
import { useGlobalResources } from "../providers/GlobalResourcesProvider";
import { processDay } from "../simulation/processDay";
import type { DayStatistics } from "../types/statistics";
import { createIsValidConnection } from "./callbacks/isValidConnection";
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

interface GameCanvasProps extends ReactFlowProps {
  onDayAdvance?: (
    globalResources: GlobalResources,
    statistics: DayStatistics,
  ) => void;
  triggerAdvance?: number;
  currentDay: number;
}

const GameCanvas = ({
  children,
  onDayAdvance,
  triggerAdvance,
  currentDay,
  ...rest
}: GameCanvasProps) => {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [reactFlowInstance, setReactFlowInstance] =
    useState<ReactFlowInstance>();

  const { resources, updateResources } = useGlobalResources();
  const prevTriggerRef = useRef(0);

  useEffect(() => {
    const newNodes = setup.buildings?.map((building) =>
      createBuildingNode(building.type, building.position),
    );

    if (newNodes) {
      setNodes(newNodes);
    }
  }, [setNodes]);

  // Process day advancement
  useEffect(() => {
    if (triggerAdvance === undefined || triggerAdvance === 0) return;
    if (triggerAdvance === prevTriggerRef.current) return;

    prevTriggerRef.current = triggerAdvance;

    const { updatedNodes, statistics } = processDay(
      nodes,
      edges,
      currentDay,
      resources,
    );

    setNodes(updatedNodes);
    updateResources(statistics.global.earned);
    onDayAdvance?.(statistics.global.resources, statistics);
  }, [
    triggerAdvance,
    currentDay,
    resources,
    onDayAdvance,
    setNodes,
    updateResources,
  ]);

  const onInit: OnInit = (instance) => {
    setReactFlowInstance(instance);
    instance.fitView({ maxZoom: 1, padding: 0.2 });
  };

  const onConnect = createOnConnect(setEdges);
  const onDrop = createOnDrop(reactFlowInstance, setNodes);
  const isValidConnection = createIsValidConnection(edges);

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
