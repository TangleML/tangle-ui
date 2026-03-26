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
  useReactFlow,
} from "@xyflow/react";
import type { ComponentType, DragEvent } from "react";
import { useEffect, useRef, useState } from "react";

import { useContextPanel } from "@/providers/ContextPanelProvider";

import { GameOverDialog } from "../components/GameOverDialog";
import { setup } from "../data/setup";
import { createBuildingNode } from "../objects/buildings/createBuildingNode";
import { setupConnections } from "../objects/resources/setupConnections";
import { useGlobalResources } from "../providers/GlobalResourcesProvider";
import { useStatistics } from "../providers/StatisticsProvider";
import { useTime } from "../providers/TimeProvider";
import { processDay } from "../simulation/processDay";
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

interface GameCanvasProps extends ReactFlowProps {}

const GameCanvas = ({ children, ...rest }: GameCanvasProps) => {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [reactFlowInstance, setReactFlowInstance] =
    useState<ReactFlowInstance>();

  const { addDayStatistics, getLatestDayStats, resetStatistics, currentDay } =
    useStatistics();
  const { resources, updateResources, resetResources, setResource } =
    useGlobalResources();
  const { pause, dayAdvanceTrigger } = useTime();

  const { fitView } = useReactFlow();
  const { clearContent } = useContextPanel();
  const [gameOverOpen, setGameOverOpen] = useState(false);

  const hasContinuedGame = useRef(false);
  const prevTriggerRef = useRef(0);

  // Process day advancement
  useEffect(() => {
    if (dayAdvanceTrigger === undefined || dayAdvanceTrigger === 0) return;
    if (dayAdvanceTrigger === prevTriggerRef.current) return;

    prevTriggerRef.current = dayAdvanceTrigger;

    const nextDay = currentDay + 1;

    const { updatedNodes, statistics } = processDay(
      nodes,
      edges,
      nextDay,
      resources,
      getLatestDayStats(),
    );

    setNodes(updatedNodes);
    updateResources(statistics.global.earned);
    addDayStatistics(statistics);

    if (statistics.global.foodDeficit > 0) {
      if (!hasContinuedGame.current) {
        setGameOverOpen(true);
        pause();
      }
    }
  }, [
    dayAdvanceTrigger,
    currentDay,
    resources,
    hasContinuedGame,
    setNodes,
    updateResources,
    getLatestDayStats,
    addDayStatistics,
  ]);

  const onInit: OnInit = (instance) => {
    setReactFlowInstance(instance);
    instance.fitView({ maxZoom: 1, padding: 0.2 });
  };

  const onConnect = reactFlowInstance
    ? createOnConnect(setEdges, reactFlowInstance)
    : undefined;
  const onDrop = createOnDrop(reactFlowInstance, setNodes);
  const isValidConnection = createIsValidConnection(edges);

  const onDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  };

  const runSetup = () => {
    setNodes([]);
    setEdges([]);
    resetResources();
    resetStatistics();
    clearContent();

    const newNodes = setup.buildings?.map((building) =>
      createBuildingNode(building.type, building.position),
    );

    setup.resources?.forEach((resource) => {
      setResource(resource.type, resource.amount);
    });

    if (newNodes) {
      setNodes(newNodes);
    }

    // Double RAF is needed to ensure nodes are rendered before we try to create edges between them
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (
          setup.connections &&
          setup.buildings &&
          newNodes &&
          reactFlowInstance
        ) {
          const newEdges = setupConnections(
            setup.connections,
            setup.buildings,
            newNodes,
            reactFlowInstance,
          );

          if (newEdges) {
            setEdges(newEdges.filter((edge): edge is Edge => edge !== null));
          }
        }
      });
    });

    fitView({ maxZoom: 1, padding: 0.2 });
  };

  const handleContinuePlaying = () => {
    setGameOverOpen(false);
    hasContinuedGame.current = true;
  };

  const handleRestart = () => {
    setGameOverOpen(false);
    hasContinuedGame.current = false;
    runSetup();
  };

  useEffect(() => {
    runSetup();
  }, [runSetup]);

  return (
    <>
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

      <GameOverDialog
        open={gameOverOpen}
        day={currentDay}
        onContinue={handleContinuePlaying}
        onRestart={handleRestart}
      />
    </>
  );
};

export default GameCanvas;
