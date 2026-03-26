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
import { useGameActions } from "../providers/GameActionsProvider";
import { useGlobalResources } from "../providers/GlobalResourcesProvider";
import { useStatistics } from "../providers/StatisticsProvider";
import { useTime } from "../providers/TimeProvider";
import { processDay } from "../simulation/processDay";
import { loadGameState, saveGameState } from "../utils/saveGame";
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

  const [hasLoadedGame, setHasLoadedGame] = useState(false);
  const [pendingSetup, setPendingSetup] = useState(false);

  const {
    addDayStatistics,
    getLatestDayStats,
    resetStatistics,
    currentDay,
    history,
    setStatisticsHistory,
  } = useStatistics();
  const {
    resources,
    updateResources,
    resetResources,
    setResource,
    setAllResources,
  } = useGlobalResources();
  const { pause, dayAdvanceTrigger } = useTime();
  const { registerRestartHandler } = useGameActions();

  const { fitView, getViewport, setViewport } = useReactFlow();
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
    const updatedResources = updateResources(statistics.global.earned);
    addDayStatistics(statistics);

    const viewport = getViewport();
    saveGameState(
      updatedNodes,
      edges,
      updatedResources,
      [...history, statistics],
      viewport,
    ).catch((error) => {
      console.error("Failed to auto-save game:", error);
    });

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
    history,
    setNodes,
    updateResources,
    getLatestDayStats,
    addDayStatistics,
    getViewport,
    pause,
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
    if (!reactFlowInstance) return;

    setNodes([]);
    setEdges([]);
    resetResources();
    resetStatistics();
    clearContent();
    hasContinuedGame.current = false;
    prevTriggerRef.current = 0;

    const newNodes = setup.buildings?.map((building) =>
      createBuildingNode(building.type, building.position),
    );

    setup.resources?.forEach((resource) => {
      setResource(resource.type, resource.amount);
    });

    if (newNodes) {
      setNodes(newNodes);
      setPendingSetup(true);
    }
  };

  useEffect(() => {
    if (!pendingSetup || !reactFlowInstance || nodes.length === 0) return;

    // Double RAF is needed to ensure nodes are rendered before we try to create edges between them
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (setup.connections && setup.buildings) {
          const newEdges = setupConnections(
            setup.connections,
            setup.buildings,
            nodes,
            reactFlowInstance,
          );

          if (newEdges && newEdges.length > 0) {
            setEdges(newEdges);
          }
        }

        fitView({ maxZoom: 1, padding: 0.2 });
        setPendingSetup(false);
      });
    });
  }, [pendingSetup, reactFlowInstance, nodes, fitView]);

  const handleContinuePlaying = () => {
    setGameOverOpen(false);
    hasContinuedGame.current = true;
  };

  const handleRestart = () => {
    setGameOverOpen(false);
    runSetup();
  };

  useEffect(() => {
    registerRestartHandler(handleRestart);
  }, [handleRestart, registerRestartHandler]);

  useEffect(() => {
    if (!reactFlowInstance || hasLoadedGame) return;

    const loadSavedGame = async () => {
      try {
        const savedGame = await loadGameState();

        if (savedGame) {
          setNodes(savedGame.nodes);
          setEdges(savedGame.edges);
          setAllResources(savedGame.globalResources);
          setStatisticsHistory(savedGame.statisticsHistory);

          if (savedGame.viewport) {
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                setViewport(savedGame.viewport!, { duration: 0 });
              });
            });
          }
        } else {
          runSetup();
        }
      } catch (error) {
        console.error("Error loading saved game:", error);
        runSetup();
      } finally {
        setHasLoadedGame(true);
      }
    };

    loadSavedGame();
  }, [reactFlowInstance, hasLoadedGame]);

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
