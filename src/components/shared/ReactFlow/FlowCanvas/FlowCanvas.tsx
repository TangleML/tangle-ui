import {
  type Connection,
  type Edge,
  type EdgeChange,
  type FinalConnectionState,
  type Node,
  type NodeChange,
  NodeToolbar,
  type OnInit,
  ReactFlow,
  type ReactFlowInstance,
  type ReactFlowProps,
  SelectionMode,
  useConnection,
  useEdgesState,
  useNodesState,
  useStoreApi,
  type XYPosition,
} from "@xyflow/react";
import type { ComponentType, DragEvent } from "react";
import { useEffect, useRef, useState } from "react";

import { ConfirmationDialog } from "@/components/shared/Dialogs";
import { BlockStack } from "@/components/ui/layout";
import useComponentSpecToEdges from "@/hooks/useComponentSpecToEdges";
import useConfirmationDialog from "@/hooks/useConfirmationDialog";
import { useCopyPaste } from "@/hooks/useCopyPaste";
import { useGhostNode } from "@/hooks/useGhostNode";
import { useIOSelectionPersistence } from "@/hooks/useIOSelectionPersistence";
import { useNodeCallbacks } from "@/hooks/useNodeCallbacks";
import { useSubgraphKeyboardNavigation } from "@/hooks/useSubgraphKeyboardNavigation";
import useToastNotification from "@/hooks/useToastNotification";
import { cn } from "@/lib/utils";
import { useComponentLibrary } from "@/providers/ComponentLibraryProvider";
import { useComponentSpec } from "@/providers/ComponentSpecProvider";
import { useContextPanel } from "@/providers/ContextPanelProvider";
import { hydrateComponentReference } from "@/services/componentService";
import {
  type ComponentSpec,
  type InputSpec,
  isNotMaterializedComponentReference,
  type TaskSpec,
} from "@/utils/componentSpec";
import { readTextFromFile } from "@/utils/dom";
import { deselectAllNodes } from "@/utils/flowUtils";
import createNodesFromComponentSpec from "@/utils/nodes/createNodesFromComponentSpec";
import {
  getSubgraphComponentSpec,
  updateSubgraphSpec,
} from "@/utils/subgraphUtils";

import { useFlagValue } from "../../Settings/useFlags";
import { useNodesOverlay } from "../NodesOverlay/NodesOverlayProvider";
import { getBulkUpdateConfirmationDetails } from "./ConfirmationDialogs/BulkUpdateConfirmationDialog";
import { getDeleteConfirmationDetails } from "./ConfirmationDialogs/DeleteConfirmation";
import { getReplaceConfirmationDetails } from "./ConfirmationDialogs/ReplaceConfirmation";
import { ConnectionLine } from "./Edges/ConnectionLine";
import SmoothEdge from "./Edges/SmoothEdge";
import GhostNode from "./GhostNode/GhostNode";
import type { GhostNodeData } from "./GhostNode/types";
import {
  computeDropPositionFromRefs,
  createGhostEdge,
} from "./GhostNode/utils";
import IONode from "./IONode/IONode";
import SelectionToolbar from "./SelectionToolbar";
import { handleGroupNodes } from "./Subgraphs/create/handleGroupNodes";
import { NewSubgraphDialog } from "./Subgraphs/create/NewSubgraphDialog";
import { canGroupNodes } from "./Subgraphs/create/utils";
import { SubgraphBreadcrumbs } from "./Subgraphs/view/SubgraphBreadcrumbs";
import TaskNode from "./TaskNode/TaskNode";
import type { NodesAndEdges } from "./types";
import addTask from "./utils/addTask";
import { createConnectedIONode } from "./utils/createConnectedIONode";
import { duplicateNodes } from "./utils/duplicateNodes";
import { isPositionInNode } from "./utils/geometry";
import { getPositionFromEvent } from "./utils/getPositionFromEvent";
import { getTaskFromEvent } from "./utils/getTaskFromEvent";
import { handleConnection } from "./utils/handleConnection";
import { removeEdge } from "./utils/removeEdge";
import { removeNode } from "./utils/removeNode";
import { replaceTaskNode } from "./utils/replaceTaskNode";
import { updateNodePositions } from "./utils/updateNodePosition";

const nodeTypes: Record<string, ComponentType<any>> = {
  task: TaskNode,
  input: IONode,
  output: IONode,
  ghost: GhostNode,
};

const SELECTABLE_NODES = new Set(["task", "input", "output"]);
const UPGRADEABLE_NODES = new Set(["task"]);
const REPLACEABLE_NODES = new Set(["task"]);

const edgeTypes: Record<string, ComponentType<any>> = {
  customEdge: SmoothEdge,
};

const useScheduleExecutionOnceWhenConditionMet = (
  condition: boolean,
  callback: () => void,
) => {
  const hasExecuted = useRef(false);
  useEffect(() => {
    if (condition && !hasExecuted.current) {
      callback();
      hasExecuted.current = true;
    }
  }, [condition, callback]);
};

const FAST_PLACE_NODE_TYPES = new Set<Node["type"]>(["task"]);

const FlowCanvas = ({
  readOnly,
  nodesConnectable,
  children,
  ...rest
}: ReactFlowProps & { readOnly?: boolean }) => {
  const initialCanvasLoaded = useRef(false);

  const { clearContent } = useContextPanel();

  useSubgraphKeyboardNavigation();
  const { setReactFlowInstance: setReactFlowInstanceForOverlay } =
    useNodesOverlay();
  const {
    componentSpec,
    setComponentSpec,
    currentGraphSpec,
    currentSubgraphSpec,
    updateGraphSpec,
    currentSubgraphPath,
  } = useComponentSpec();
  const { preserveIOSelectionOnSpecChange, resetPrevSpec } =
    useIOSelectionPersistence();

  const isPartialSelectionEnabled = useFlagValue("partial-selection");

  const store = useStoreApi();
  const { edges: specEdges, onEdgesChange } =
    useComponentSpecToEdges(currentSubgraphSpec);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges] = useEdgesState<Edge>(specEdges);

  const isBoxSelecting = useRef(false);

  const handleEdgesChange = (changes: EdgeChange[]) => {
    if (!isBoxSelecting.current) {
      onEdgesChange(changes);
      return;
    }

    const filtered = changes.filter((change) => change.type !== "select");
    if (filtered.length > 0) {
      onEdgesChange(filtered);
    }
  };

  const isConnecting = useConnection((connection) => connection.inProgress);
  const connectionSourceHandle = useConnection(
    (connection) => connection.fromHandle,
  );

  const {
    handlers: confirmationHandlers,
    triggerDialog: triggerConfirmation,
    ...confirmationProps
  } = useConfirmationDialog();

  const [showNewSubgraphDialog, setShowNewSubgraphDialog] = useState(false);

  const notify = useToastNotification();

  const latestFlowPosRef = useRef<XYPosition>(null);
  const ghostNodeRef = useRef<Node<GhostNodeData> | null>(null);
  const shouldCreateIONodeRef = useRef(false);

  const [showToolbar, setShowToolbar] = useState(false);
  const [replaceTarget, setReplaceTarget] = useState<Node | null>(null);
  const [shiftKeyPressed, setShiftKeyPressed] = useState(false);
  const [metaKeyPressed, setMetaKeyPressed] = useState(false);

  const { addToComponentLibrary } = useComponentLibrary();

  const handleKeyDown = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement;
    const isInputFocused =
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.isContentEditable ||
      target.closest('[data-slot="input"]');

    if (isInputFocused) {
      return;
    }

    if (event.key === "Shift") {
      setShiftKeyPressed(true);
    }

    if (event.key === "Meta" || event.key === "Control") {
      setMetaKeyPressed(true);
    }

    if (event.key === "a" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();

      setNodes((currentNodes) =>
        currentNodes.map((node) => ({
          ...node,
          selected:
            event.shiftKey || !node.type
              ? false
              : SELECTABLE_NODES.has(node.type),
        })),
      );
    }
  };

  const handleKeyUp = (event: KeyboardEvent) => {
    if (event.key === "Shift") {
      setShiftKeyPressed(false);
    }
    if (event.key === "Meta" || event.key === "Control") {
      setMetaKeyPressed(false);
    }
  };

  const handleMouseDown = (event: MouseEvent) => {
    if (event.shiftKey && event.target instanceof HTMLElement) {
      const reactFlowWrapper = event.target.closest(".react-flow");
      if (reactFlowWrapper) {
        event.preventDefault();
      }
    }
  };

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("keyup", handleKeyUp);
    document.addEventListener("mousedown", handleMouseDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("keyup", handleKeyUp);
      document.removeEventListener("mousedown", handleMouseDown);
    };
  }, [handleKeyDown, handleKeyUp, handleMouseDown]);

  const [reactFlowInstance, setReactFlowInstance] =
    useState<ReactFlowInstance>();

  const onInit: OnInit = (instance) => {
    setReactFlowInstance(instance);
    setReactFlowInstanceForOverlay(instance);
  };

  const updateOrAddNodes = ({
    updatedNodes,
    newNodes,
  }: {
    updatedNodes?: Node[];
    newNodes?: Node[];
  }) => {
    setNodes((prev) => {
      const updated = prev.map((node) => {
        const updatedNode = updatedNodes?.find(
          (updatedNode) => updatedNode.id === node.id,
        );
        return updatedNode ? { ...node, ...updatedNode } : node;
      });

      if (!newNodes) {
        return updated;
      }

      return [...updated, ...newNodes];
    });
  };

  const { ghostNode, shouldCreateIONode } = useGhostNode({
    readOnly,
    active: metaKeyPressed,
    isConnecting,
    implementation: currentSubgraphSpec.implementation,
  });

  useEffect(() => {
    if (!!ghostNode && connectionSourceHandle) {
      const ghostEdge = createGhostEdge(connectionSourceHandle);
      setEdges([...specEdges, ghostEdge]);

      return;
    }

    setEdges(specEdges);
  }, [ghostNode, connectionSourceHandle, specEdges, setEdges]);

  const nodesForRender: Node[] = ghostNode ? [...nodes, ghostNode] : nodes;

  useEffect(() => {
    shouldCreateIONodeRef.current = shouldCreateIONode;
  }, [shouldCreateIONode]);

  useEffect(() => {
    ghostNodeRef.current = ghostNode;
  }, [ghostNode]);

  const selectedNodes = nodes.filter(
    (node) => node.selected && node.type && SELECTABLE_NODES.has(node.type),
  );

  const selectedEdges = edges.filter((edge) => edge.selected);

  const selectedElements = {
    nodes: selectedNodes,
    edges: selectedEdges,
  };

  const canUpgrade = selectedNodes.some(
    (node) => node.type && UPGRADEABLE_NODES.has(node.type),
  );

  const { canGroup } = canGroupNodes(selectedNodes);

  const onElementsRemove = (params: NodesAndEdges) => {
    let updatedSubgraphSpec = { ...currentSubgraphSpec };

    for (const edge of params.edges) {
      updatedSubgraphSpec = removeEdge(edge, updatedSubgraphSpec);
    }
    for (const node of params.nodes) {
      updatedSubgraphSpec = removeNode(node, updatedSubgraphSpec);
    }

    const updatedRootSpec = updateSubgraphSpec(
      componentSpec,
      currentSubgraphPath,
      updatedSubgraphSpec,
    );

    setComponentSpec(updatedRootSpec);
  };

  const nodeCallbacks = useNodeCallbacks({
    triggerConfirmation,
    onElementsRemove,
    updateOrAddNodes,
  });

  const nodeData = {
    connectable: !readOnly && !!nodesConnectable,
    readOnly,
    nodeCallbacks,
  };

  const updateReactFlow = (newComponentSpec: ComponentSpec) => {
    const subgraphSpec = getSubgraphComponentSpec(
      newComponentSpec,
      currentSubgraphPath,
      notify,
    );
    const newNodes = createNodesFromComponentSpec(subgraphSpec, nodeData);

    const updatedNewNodes = newNodes.map((node) => ({
      ...node,
      data: {
        ...node.data,
        highlighted: node.id === replaceTarget?.id,
      },
    }));

    setNodes((prevNodes) => {
      const updatedNodes = updatedNewNodes.map((newNode) => {
        const existingNode = prevNodes.find((node) => node.id === newNode.id);
        return existingNode ? { ...existingNode, ...newNode } : newNode;
      });

      return updatedNodes;
    });
  };

  const onConnect = (connection: Connection) => {
    if (connection.source === connection.target) return;

    const updatedGraphSpec = handleConnection(currentGraphSpec, connection);
    updateGraphSpec(updatedGraphSpec);
  };

  const handleGhostDrop = (
    finalConnectionState: FinalConnectionState | null,
  ) => {
    const fromNode = finalConnectionState?.fromNode;
    const fromHandle = finalConnectionState?.fromHandle;

    if (!fromNode || !fromHandle?.id) {
      return false;
    }

    if (!FAST_PLACE_NODE_TYPES.has(fromNode.type)) {
      return false;
    }

    const position = computeDropPositionFromRefs(
      ghostNodeRef.current,
      latestFlowPosRef.current,
      fromHandle.type,
      store.getState(),
    );

    if (!position) {
      return false;
    }

    if (fromHandle.type !== "source" && fromHandle.type !== "target") {
      return false;
    }

    const ioType: GhostNodeData["ioType"] =
      fromHandle.type === "source" ? "output" : "input";
    const updatedSubgraphSpec = createConnectedIONode({
      componentSpec: currentSubgraphSpec,
      taskNodeId: fromHandle.nodeId,
      handleId: fromHandle.id,
      position,
      ioType,
    });

    const updatedRootSpec = updateSubgraphSpec(
      componentSpec,
      currentSubgraphPath,
      updatedSubgraphSpec,
    );
    setComponentSpec(updatedRootSpec);
    updateReactFlow(updatedRootSpec);
    shouldCreateIONodeRef.current = false;

    return true;
  };

  const onConnectEnd = (
    e: MouseEvent | TouchEvent,
    connectionState: FinalConnectionState,
  ) => {
    if (connectionState.isValid) {
      return;
    }

    if (!(e instanceof MouseEvent)) {
      return;
    }

    if (!shouldCreateIONodeRef.current) {
      return;
    }

    handleGhostDrop(connectionState);
  };

  useEffect(() => {
    function handleMouseMove(event: MouseEvent) {
      if (isConnecting && reactFlowInstance) {
        const flowPos = reactFlowInstance.screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        });
        latestFlowPosRef.current = flowPos;
      }
    }
    if (isConnecting) {
      window.addEventListener("mousemove", handleMouseMove);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, [isConnecting, reactFlowInstance]);

  const onDragOver = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();

    // Check if we're dragging files
    const hasFiles = event.dataTransfer.types.includes("Files");
    if (hasFiles) {
      return;
    }

    event.dataTransfer.dropEffect = "move";

    const cursorPosition = reactFlowInstance?.screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    });

    if (cursorPosition) {
      const hoveredNode = nodes.find((node) =>
        isPositionInNode(node, cursorPosition),
      );

      if (!hoveredNode && replaceTarget) {
        setReplaceTarget(null);
        return;
      }

      if (!hoveredNode || hoveredNode.id === replaceTarget?.id) return;

      if (hoveredNode.type && !REPLACEABLE_NODES.has(hoveredNode.type)) {
        setReplaceTarget(null);
        return;
      }

      setReplaceTarget(hoveredNode);
    }
  };

  const onDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (readOnly) return;

    // Handle file drops
    if (event.dataTransfer.files.length > 0) {
      try {
        // Parse the imported YAML to get the component spec
        const content = await readTextFromFile(event.dataTransfer.files[0]);
        const hydratedComponentRef = await hydrateComponentReference({
          text: content,
        });

        if (!hydratedComponentRef) {
          notify(
            "Failed to parse component spec from imported content",
            "error",
          );
          return;
        }

        const result = await addToComponentLibrary(hydratedComponentRef);

        if (result && reactFlowInstance) {
          // Use the drop position if available
          const position = getPositionFromEvent(event, reactFlowInstance);
          const taskSpec: TaskSpec = {
            annotations: {},
            componentRef: hydratedComponentRef,
          };
          const { spec: newComponentSpec } = addTask(
            "task",
            taskSpec,
            position,
            componentSpec,
          );

          setComponentSpec(newComponentSpec);
        }
      } catch (error) {
        console.error("Failed to add imported component to canvas:", error);
        notify("Failed to add component to canvas", "error");
      }

      return;
    }

    const { taskSpec: droppedTask, taskType } = getTaskFromEvent(event);

    if (!taskType) {
      console.error("Dropped task type not identified.");
      return;
    }

    if (!droppedTask && taskType === "task") {
      console.error("Unable to find dropped task.");
      return;
    }

    if (isNotMaterializedComponentReference(droppedTask?.componentRef)) {
      // load spec
      const hydratedComponentRef = await hydrateComponentReference(
        droppedTask.componentRef,
      );

      if (hydratedComponentRef) {
        droppedTask.componentRef = hydratedComponentRef;
      } else {
        notify(
          "Failed to add component to canvas. Please, try again.",
          "error",
        );
        return;
      }
    }

    // Replacing an existing node
    if (replaceTarget) {
      if (!droppedTask) {
        console.error(
          "Replacement by Input or Output node is currently unsupported.",
        );
        return;
      }

      const { updatedGraphSpec, lostInputs, newTaskId } = replaceTaskNode(
        replaceTarget.data.taskId as string,
        droppedTask.componentRef,
        currentGraphSpec,
      );

      const dialogData = getReplaceConfirmationDetails(
        replaceTarget,
        newTaskId,
        lostInputs,
      );

      const confirmed = await triggerConfirmation(dialogData);

      setReplaceTarget(null);

      if (confirmed) {
        updateGraphSpec(updatedGraphSpec);
      }

      return;
    }

    if (reactFlowInstance) {
      const position = getPositionFromEvent(event, reactFlowInstance);

      const { spec: newSubgraphSpec } = addTask(
        taskType,
        droppedTask,
        position,
        currentSubgraphSpec,
      );

      const newRootSpec = updateSubgraphSpec(
        componentSpec,
        currentSubgraphPath,
        newSubgraphSpec,
      );

      setComponentSpec(newRootSpec);
    }
  };

  const onRemoveNodes = async () => {
    const confirmed = await triggerConfirmation(
      getDeleteConfirmationDetails({ nodes: selectedNodes, edges: [] }),
    );
    if (confirmed) {
      onElementsRemove(selectedElements);
    }
  };

  const handleOnNodesChange = (changes: NodeChange[]) => {
    const positionChanges = changes.filter(
      (change) => change.type === "position" && change.dragging === false,
    );

    if (positionChanges.length > 0) {
      const updatedNodes = positionChanges
        .map((change) => {
          if ("id" in change && "position" in change && change.position) {
            const node = nodes.find((n) => n.id === change.id);
            return node
              ? {
                  ...node,
                  position: { x: change.position.x, y: change.position.y },
                }
              : null;
          }
          return null;
        })
        .filter(Boolean) as Node[];

      if (updatedNodes.length > 0) {
        const updatedSubgraphSpec = updateNodePositions(
          updatedNodes,
          currentSubgraphSpec,
        );

        const updatedRootSpec = updateSubgraphSpec(
          componentSpec,
          currentSubgraphPath,
          updatedSubgraphSpec,
        );

        setComponentSpec(updatedRootSpec);
      }
    }

    onNodesChange(changes);
  };

  const handleBeforeDelete = async (params: NodesAndEdges) => {
    if (readOnly) {
      return false;
    }

    if (params.nodes.length === 0 && params.edges.length === 0) {
      return false;
    }

    // Skip confirmation if Shift key is pressed
    if (shiftKeyPressed) {
      return true;
    }

    const confirmed = await triggerConfirmation(
      getDeleteConfirmationDetails(params),
    );

    return confirmed;
  };

  const onDuplicateNodes = () => {
    const {
      updatedComponentSpec: updatedSubgraphSpec,
      newNodes,
      updatedNodes,
    } = duplicateNodes(currentSubgraphSpec, selectedNodes, { selected: true });

    const updatedRootSpec = updateSubgraphSpec(
      componentSpec,
      currentSubgraphPath,
      updatedSubgraphSpec,
    );

    setComponentSpec(updatedRootSpec);

    updateOrAddNodes({
      updatedNodes,
      newNodes,
    });
  };

  const onUpgradeNodes = async () => {
    let newGraphSpec = currentGraphSpec;
    const allLostInputs: InputSpec[] = [];
    const includedNodes: Node[] = [];
    const excludedNodes: Node[] = [];

    selectedNodes.forEach((node) => {
      if (node.type && !UPGRADEABLE_NODES.has(node.type)) {
        excludedNodes.push(node);
        return;
      }

      const taskSpec = node.data.taskSpec as TaskSpec | undefined;
      // Custom components don't have a componentRef.url so they are currently excluded from bulk operations
      if (taskSpec?.componentRef && taskSpec.componentRef.url) {
        const { updatedGraphSpec, lostInputs } = replaceTaskNode(
          node.data.taskId as string,
          taskSpec.componentRef,
          newGraphSpec,
        );

        if (lostInputs.length > 0) {
          allLostInputs.push(...lostInputs);
        }

        includedNodes.push(node);
        newGraphSpec = { ...updatedGraphSpec };
      } else {
        excludedNodes.push(node);
      }
    });

    if (includedNodes.length === 0) {
      notify("Selected nodes are not upgradeable", "info");
      return;
    }

    const dialogData = getBulkUpdateConfirmationDetails(
      includedNodes,
      excludedNodes,
      allLostInputs,
    );

    const confirmed = await triggerConfirmation(dialogData);

    if (confirmed) {
      updateGraphSpec(newGraphSpec);
      notify(`${includedNodes.length} nodes updated`, "success");
    }
  };

  const onGroupNodes = async () => {
    if (!canGroup) return;
    setShowNewSubgraphDialog(true);
  };

  const handleCreateSubgraph = async (activeNodes: Node[], name: string) => {
    const onSuccess = (updatedComponentSpec: ComponentSpec) => {
      const updatedRootSpec = updateSubgraphSpec(
        componentSpec,
        currentSubgraphPath,
        updatedComponentSpec,
      );

      setComponentSpec(updatedRootSpec);

      setNodes((nodes) => deselectAllNodes(nodes));
    };

    const onError = (error: Error) => {
      console.error("Failed to create subgraph:", error);
      notify("Failed to create subgraph", "error");
    };

    await handleGroupNodes(
      activeNodes,
      currentSubgraphSpec,
      name,
      onSuccess,
      onError,
    );
  };

  const handleSelectionChange = () => {
    if (selectedNodes.length < 1) {
      setShowToolbar(false);
    }
  };

  const handleSelectionStart = () => {
    isBoxSelecting.current = true;
  };

  const handleSelectionEnd = () => {
    isBoxSelecting.current = false;
    setShowToolbar(true);
  };

  useEffect(() => {
    preserveIOSelectionOnSpecChange(componentSpec);
    updateReactFlow(componentSpec);
    initialCanvasLoaded.current = true;
  }, [
    replaceTarget,
    componentSpec,
    currentSubgraphPath,
    preserveIOSelectionOnSpecChange,
  ]);

  useEffect(() => {
    reactFlowInstance?.fitView({
      maxZoom: 1,
      duration: 300,
    });
  }, [currentSubgraphPath, reactFlowInstance]);

  // Reset when loading a new component file
  useEffect(() => {
    resetPrevSpec();
  }, [componentSpec?.name, resetPrevSpec]);

  const fitView = () => {
    reactFlowInstance?.fitView({
      maxZoom: 1,
    });
  };

  useScheduleExecutionOnceWhenConditionMet(
    initialCanvasLoaded.current && !!reactFlowInstance,
    fitView,
  );

  const onCopy = () => {
    // Copy selected nodes to clipboard
    if (selectedNodes.length > 0) {
      const selectedNodesJson = JSON.stringify(selectedNodes);
      navigator.clipboard.writeText(selectedNodesJson).catch((err) => {
        console.error("Failed to copy nodes to clipboard:", err);
      });
      const message = `Copied ${selectedNodes.length} nodes to clipboard`;
      notify(message, "success");
    }
  };

  const onPaste = () => {
    if (readOnly) return;

    // Paste nodes from clipboard to the centre of the Canvas
    navigator.clipboard.readText().then((clipboardText) => {
      try {
        let parsedData;
        try {
          parsedData = JSON.parse(clipboardText);
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (err) {
          return;
        }

        const nodesToPaste: Node[] = parsedData;

        // Get the center of the canvas
        const { domNode } = store.getState();
        const boundingRect = domNode?.getBoundingClientRect();

        if (boundingRect) {
          const center = reactFlowInstance?.screenToFlowPosition({
            x: boundingRect.x + boundingRect.width / 2,
            y: boundingRect.y + boundingRect.height / 2,
          });

          const reactFlowCenter = {
            x: center?.x || 0,
            y: center?.y || 0,
          };

          const { newNodes, updatedComponentSpec: updatedSubgraphSpec } =
            duplicateNodes(currentSubgraphSpec, nodesToPaste, {
              position: reactFlowCenter,
              connection: "internal",
            });

          // Deselect all existing nodes
          const updatedNodes = nodes.map((node) => ({
            ...node,
            selected: false,
          }));

          updateOrAddNodes({
            updatedNodes,
            newNodes,
          });

          const updatedRootSpec = updateSubgraphSpec(
            componentSpec,
            currentSubgraphPath,
            updatedSubgraphSpec,
          );

          setComponentSpec(updatedRootSpec);
        }
      } catch (err) {
        console.error("Failed to paste nodes from clipboard:", err);
      }
    });
  };

  useCopyPaste({
    onCopy,
    onPaste,
  });

  const onPaneClick = () => {
    clearContent();
  };

  const getSelectionMode = () => {
    if (!isPartialSelectionEnabled) {
      return SelectionMode.Full;
    }

    if (shiftKeyPressed && metaKeyPressed) {
      return SelectionMode.Partial;
    }

    return SelectionMode.Full;
  };

  const selectionMode = getSelectionMode();

  return (
    <BlockStack fill>
      <SubgraphBreadcrumbs />
      <ReactFlow
        {...rest}
        nodes={nodesForRender}
        edges={edges}
        minZoom={0.01}
        maxZoom={3}
        selectionMode={selectionMode}
        onNodesChange={handleOnNodesChange}
        onEdgesChange={handleEdgesChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onConnect={onConnect}
        onConnectEnd={onConnectEnd}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onPaneClick={onPaneClick}
        onBeforeDelete={handleBeforeDelete}
        onDelete={onElementsRemove}
        onInit={onInit}
        deleteKeyCode={["Delete", "Backspace"]}
        onSelectionChange={handleSelectionChange}
        onSelectionStart={handleSelectionStart}
        onSelectionEnd={handleSelectionEnd}
        nodesConnectable={readOnly ? false : nodesConnectable}
        connectOnClick={!readOnly}
        connectionLineComponent={ConnectionLine}
        proOptions={{ hideAttribution: true }}
        className={cn(
          (rest.selectionOnDrag || (shiftKeyPressed && !isConnecting)) &&
            "cursor-crosshair",
        )}
      >
        <NodeToolbar
          nodeId={selectedNodes.map((node) => node.id)}
          isVisible={showToolbar}
          offset={0}
          align="end"
        >
          <SelectionToolbar
            onDelete={!readOnly ? onRemoveNodes : undefined}
            onDuplicate={!readOnly ? onDuplicateNodes : undefined}
            onCopy={!readOnly ? undefined : onCopy}
            onUpgrade={!readOnly && canUpgrade ? onUpgradeNodes : undefined}
            onGroup={!readOnly && canGroup ? onGroupNodes : undefined}
          />
        </NodeToolbar>
        {children}
      </ReactFlow>

      <ConfirmationDialog
        {...confirmationProps}
        onConfirm={() => confirmationHandlers?.onConfirm()}
        onCancel={() => confirmationHandlers?.onCancel()}
      />
      <NewSubgraphDialog
        open={showNewSubgraphDialog}
        onClose={() => setShowNewSubgraphDialog(false)}
        selectedNodes={selectedNodes}
        currentSubgraphSpec={currentSubgraphSpec}
        onCreateSubgraph={handleCreateSubgraph}
      />
    </BlockStack>
  );
};

export default FlowCanvas;
