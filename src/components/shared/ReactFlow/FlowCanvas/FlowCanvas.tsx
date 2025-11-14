import {
  type Connection,
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
  useNodesState,
  useStoreApi,
  type XYPosition,
} from "@xyflow/react";
import type { ComponentType, DragEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ConfirmationDialog } from "@/components/shared/Dialogs";
import { BlockStack } from "@/components/ui/layout";
import useComponentSpecToEdges from "@/hooks/useComponentSpecToEdges";
import useComponentUploader from "@/hooks/useComponentUploader";
import useConfirmationDialog from "@/hooks/useConfirmationDialog";
import { useCopyPaste } from "@/hooks/useCopyPaste";
import { useGhostNode } from "@/hooks/useGhostNode";
import { useHintNode } from "@/hooks/useHintNode";
import useInputDialog from "@/hooks/useInputDialog";
import { useIOSelectionPersistence } from "@/hooks/useIOSelectionPersistence";
import { useNodeCallbacks } from "@/hooks/useNodeCallbacks";
import { useSubgraphKeyboardNavigation } from "@/hooks/useSubgraphKeyboardNavigation";
import useToastNotification from "@/hooks/useToastNotification";
import { cn } from "@/lib/utils";
import { useComponentSpec } from "@/providers/ComponentSpecProvider";
import { useContextPanel } from "@/providers/ContextPanelProvider";
import { hydrateComponentReference } from "@/services/componentService";
import {
  type ComponentReference,
  type ComponentSpec,
  type InputSpec,
  isNotMaterializedComponentReference,
  type TaskSpec,
} from "@/utils/componentSpec";
import { loadComponentAsRefFromText } from "@/utils/componentStore";
import createNodesFromComponentSpec from "@/utils/nodes/createNodesFromComponentSpec";
import {
  getSubgraphComponentSpec,
  updateSubgraphSpec,
} from "@/utils/subgraphUtils";

import ComponentDuplicateDialog from "../../Dialogs/ComponentDuplicateDialog";
import { InputDialog } from "../../Dialogs/InputDialog";
import { useBetaFlagValue } from "../../Settings/useBetaFlags";
import { useNodesOverlay } from "../NodesOverlay/NodesOverlayProvider";
import { handleGroupNodes } from "./callbacks/handleGroupNodes";
import { getBulkUpdateConfirmationDetails } from "./ConfirmationDialogs/BulkUpdateConfirmationDialog";
import { getDeleteConfirmationDetails } from "./ConfirmationDialogs/DeleteConfirmation";
import { getReplaceConfirmationDetails } from "./ConfirmationDialogs/ReplaceConfirmation";
import SmoothEdge from "./Edges/SmoothEdge";
import GhostNode from "./GhostNode/GhostNode";
import HintNode from "./GhostNode/HintNode";
import IONode from "./IONode/IONode";
import { NodesList } from "./NodesList";
import SelectionToolbar from "./SelectionToolbar";
import { SubgraphBreadcrumbs } from "./SubgraphBreadcrumbs/SubgraphBreadcrumbs";
import TaskNode from "./TaskNode/TaskNode";
import type { NodesAndEdges } from "./types";
import { addAndConnectNode } from "./utils/addAndConnectNode";
import addTask from "./utils/addTask";
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
  hint: HintNode,
  ghost: GhostNode,
  input: IONode,
  output: IONode,
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

  const isSubgraphNavigationEnabled = useBetaFlagValue("subgraph-navigation");
  const isPartialSelectionEnabled = useBetaFlagValue("partial-selection");

  const { edges, onEdgesChange } = useComponentSpecToEdges(currentSubgraphSpec);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);

  const isConnecting = useConnection((connection) => connection.inProgress);
  const { ghostNode, handleTabCycle } = useGhostNode();

  const tabHintNode = useHintNode({
    key: "TAB",
    hint: "cycle compatible components",
  });

  const allNodes = useMemo(() => {
    if (readOnly) return nodes;
    if (ghostNode) {
      return [...nodes, ghostNode];
    } else if (tabHintNode) {
      return [...nodes, tabHintNode];
    }
    return nodes;
  }, [readOnly, nodes, ghostNode, tabHintNode]);

  const {
    handlers: confirmationHandlers,
    triggerDialog: triggerConfirmation,
    ...confirmationProps
  } = useConfirmationDialog();

  const { triggerInputDialog, ...inputDialogProps } = useInputDialog();

  const notify = useToastNotification();

  const latestFlowPosRef = useRef<XYPosition>(null);

  const [showToolbar, setShowToolbar] = useState(false);
  const [replaceTarget, setReplaceTarget] = useState<Node | null>(null);
  const [shiftKeyPressed, setShiftKeyPressed] = useState(false);
  const [metaKeyPressed, setMetaKeyPressed] = useState(false);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const isInputFocused =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable ||
        target.closest('[data-slot="input"]');

      // Skip canvas shortcuts if an input is focused
      if (isInputFocused) {
        return;
      }

      if (event.key === "Shift") {
        setShiftKeyPressed(true);
      }

      if (event.key === "Meta" || event.key === "Control") {
        setMetaKeyPressed(true);
      }

      if (event.key === "Tab") {
        const direction = event.shiftKey ? "back" : "forward";
        const handled = handleTabCycle(direction);
        if (handled) {
          event.preventDefault();
        }
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
    },
    [handleTabCycle, setNodes],
  );

  const handleKeyUp = useCallback((event: KeyboardEvent) => {
    if (event.key === "Shift") {
      setShiftKeyPressed(false);
    }
    if (event.key === "Meta" || event.key === "Control") {
      setMetaKeyPressed(false);
    }
  }, []);

  const handleMouseDown = useCallback((event: MouseEvent) => {
    if (event.shiftKey && event.target instanceof HTMLElement) {
      const reactFlowWrapper = event.target.closest(".react-flow");
      if (reactFlowWrapper) {
        event.preventDefault();
      }
    }
  }, []);

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

  const updateOrAddNodes = useCallback(
    ({
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
    },
    [setNodes],
  );

  const selectedNodes = useMemo(
    () =>
      nodes.filter(
        (node) => node.selected && node.type && SELECTABLE_NODES.has(node.type),
      ),
    [nodes],
  );
  const selectedEdges = useMemo(
    () => edges.filter((edge) => edge.selected),
    [edges],
  );

  const selectedElements = useMemo(
    () => ({
      nodes: selectedNodes,
      edges: selectedEdges,
    }),
    [selectedNodes, selectedEdges],
  );

  const canUpgrade = useMemo(
    () =>
      selectedNodes.some(
        (node) => node.type && UPGRADEABLE_NODES.has(node.type),
      ),
    [selectedNodes],
  );

  const canGroup = useMemo(
    () =>
      selectedNodes.length > 1 &&
      selectedNodes.filter((node) => node.type === "task").length > 0 &&
      isSubgraphNavigationEnabled,
    [selectedNodes, isSubgraphNavigationEnabled],
  );

  const onElementsRemove = useCallback(
    (params: NodesAndEdges) => {
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
    },
    [componentSpec, currentSubgraphSpec, currentSubgraphPath, setComponentSpec],
  );

  const nodeCallbacks = useNodeCallbacks({
    triggerConfirmation,
    onElementsRemove,
    updateOrAddNodes,
  });

  const nodeData = useMemo(
    () => ({
      connectable: !readOnly && !!nodesConnectable,
      readOnly,
      nodeCallbacks,
    }),
    [readOnly, nodesConnectable, nodeCallbacks],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (connection.source === connection.target) return;

      const updatedGraphSpec = handleConnection(currentGraphSpec, connection);
      updateGraphSpec(updatedGraphSpec);
    },
    [currentGraphSpec, handleConnection, updateGraphSpec],
  );

  const onConnectEnd = useCallback(
    (_e: MouseEvent | TouchEvent, connectionState: FinalConnectionState) => {
      if (connectionState.isValid) {
        // Valid connections are handled by onConnect
        return;
      }

      const ghostNode = reactFlowInstance
        ?.getNodes()
        .find((node) => node.type === "ghost");

      if (!ghostNode) {
        return;
      }

      const { componentRef } = ghostNode.data as {
        componentRef: ComponentReference;
      };

      const position = latestFlowPosRef.current;
      if (!position) return;

      let newComponentSpec = { ...componentSpec };
      const fromHandle = connectionState.fromHandle;

      const existingInputEdge = reactFlowInstance
        ?.getEdges()
        .find(
          (edge) =>
            edge.target === fromHandle?.nodeId &&
            edge.targetHandle === fromHandle.id,
        );

      if (existingInputEdge) {
        newComponentSpec = removeEdge(existingInputEdge, newComponentSpec);
      }

      const updatedComponentSpec = addAndConnectNode({
        componentRef,
        fromHandle,
        position,
        componentSpec: newComponentSpec,
      });

      setComponentSpec(updatedComponentSpec);
    },
    [
      reactFlowInstance,
      componentSpec,
      nodeData,
      setComponentSpec,
      updateOrAddNodes,
    ],
  );

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

  const {
    handleDrop,
    existingAndNewComponent,
    handleCancelUpload,
    handleImportComponent,
  } = useComponentUploader(readOnly, {
    onImportSuccess: async (
      content: string,
      dropEvent?: DragEvent<HTMLDivElement>,
    ) => {
      if (readOnly) return;

      try {
        // Parse the imported YAML to get the component spec
        const componentRef = await loadComponentAsRefFromText(content);

        if (!componentRef.spec) {
          console.error("Failed to parse component spec from imported content");
          return;
        }

        let position;

        if (dropEvent && reactFlowInstance) {
          // Use the drop position if available
          position = getPositionFromEvent(dropEvent, reactFlowInstance);
        } else {
          // Fallback to center of the canvas viewport
          const { domNode } = store.getState();
          const boundingRect = domNode?.getBoundingClientRect();

          if (boundingRect && reactFlowInstance) {
            position = reactFlowInstance.screenToFlowPosition({
              x: boundingRect.x + boundingRect.width / 2,
              y: boundingRect.y + boundingRect.height / 2,
            });
          }
        }

        if (position) {
          const taskSpec: TaskSpec = {
            annotations: {},
            componentRef: { ...componentRef },
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
    },
  });

  const onDragOver = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
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

        if (hoveredNode?.id === replaceTarget?.id) return;
        if (hoveredNode?.type && !REPLACEABLE_NODES.has(hoveredNode.type)) {
          setReplaceTarget(null);
          return;
        }

        setReplaceTarget(hoveredNode || null);
      }
    },
    [reactFlowInstance, nodes, replaceTarget, setReplaceTarget],
  );

  const onDrop = useCallback(
    async (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();

      // Handle file drops
      if (event.dataTransfer.files.length > 0) {
        handleDrop(event);
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
    },
    [
      componentSpec,
      currentSubgraphSpec,
      currentSubgraphPath,
      reactFlowInstance,
      replaceTarget,
      setComponentSpec,
      updateGraphSpec,
      triggerConfirmation,
      handleDrop,
      notify,
    ],
  );

  const onRemoveNodes = useCallback(async () => {
    const confirmed = await triggerConfirmation(
      getDeleteConfirmationDetails({ nodes: selectedNodes, edges: [] }),
    );
    if (confirmed) {
      onElementsRemove(selectedElements);
    }
  }, [selectedElements, onElementsRemove, triggerConfirmation]);

  const handleOnNodesChange = useCallback(
    (changes: NodeChange[]) => {
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
    },
    [
      nodes,
      componentSpec,
      currentSubgraphSpec,
      currentSubgraphPath,
      setComponentSpec,
      onNodesChange,
    ],
  );

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

  const onDuplicateNodes = useCallback(() => {
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
  }, [
    componentSpec,
    currentSubgraphSpec,
    currentSubgraphPath,
    selectedNodes,
    setComponentSpec,
    setNodes,
  ]);

  const onUpgradeNodes = useCallback(async () => {
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
  }, [
    currentGraphSpec,
    selectedNodes,
    updateGraphSpec,
    notify,
    triggerConfirmation,
  ]);

  const onGroupNodes = useCallback(async () => {
    if (!canGroup) return;

    const nodesList = (
      <NodesList
        nodes={selectedNodes}
        title={`Nodes being grouped (${selectedNodes.length})`}
      />
    );

    const onSuccess = (updatedComponentSpec: ComponentSpec) => {
      const updatedRootSpec = updateSubgraphSpec(
        componentSpec,
        currentSubgraphPath,
        updatedComponentSpec,
      );

      setComponentSpec(updatedRootSpec);
    };

    const onError = (error: Error) => {
      console.error("Failed to create subgraph:", error);
      notify("Failed to create subgraph", "error");
    };

    handleGroupNodes(
      selectedNodes,
      currentSubgraphSpec,
      nodesList,
      triggerInputDialog,
      onSuccess,
      onError,
    );
  }, [
    selectedNodes,
    componentSpec,
    currentSubgraphSpec,
    currentSubgraphPath,
    canGroup,
    setComponentSpec,
    triggerInputDialog,
    notify,
  ]);

  const handleSelectionChange = useCallback(() => {
    if (selectedNodes.length < 1) {
      setShowToolbar(false);
    }
  }, [selectedNodes]);

  const handleSelectionEnd = useCallback(() => {
    setShowToolbar(true);
  }, []);

  const updateReactFlow = useCallback(
    (newComponentSpec: ComponentSpec) => {
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
    },
    [setNodes, nodeData, replaceTarget, currentSubgraphPath],
  );

  useEffect(() => {
    preserveIOSelectionOnSpecChange(componentSpec);
    updateReactFlow(componentSpec);
    initialCanvasLoaded.current = true;
  }, [componentSpec, currentSubgraphPath, preserveIOSelectionOnSpecChange]);

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

  const fitView = useCallback(() => {
    reactFlowInstance?.fitView({
      maxZoom: 1,
    });
  }, [reactFlowInstance]);

  useScheduleExecutionOnceWhenConditionMet(
    initialCanvasLoaded.current && !!reactFlowInstance,
    fitView,
  );

  const store = useStoreApi();

  const onCopy = useCallback(() => {
    // Copy selected nodes to clipboard
    if (selectedNodes.length > 0) {
      const selectedNodesJson = JSON.stringify(selectedNodes);
      navigator.clipboard.writeText(selectedNodesJson).catch((err) => {
        console.error("Failed to copy nodes to clipboard:", err);
      });
      const message = `Copied ${selectedNodes.length} nodes to clipboard`;
      notify(message, "success");
    }
  }, [selectedNodes]);

  const onPaste = useCallback(() => {
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

          const { newNodes, updatedComponentSpec } = duplicateNodes(
            componentSpec,
            nodesToPaste,
            { position: reactFlowCenter, connection: "internal" },
          );

          // Deselect all existing nodes
          const updatedNodes = nodes.map((node) => ({
            ...node,
            selected: false,
          }));

          updateOrAddNodes({
            updatedNodes,
            newNodes,
          });

          setComponentSpec(updatedComponentSpec);
        }
      } catch (err) {
        console.error("Failed to paste nodes from clipboard:", err);
      }
    });
  }, [
    componentSpec,
    nodes,
    reactFlowInstance,
    store,
    updateOrAddNodes,
    setComponentSpec,
    readOnly,
  ]);

  useCopyPaste({
    onCopy,
    onPaste,
  });

  const onPaneClick = () => {
    clearContent();
  };

  const selectionMode = useMemo(() => {
    if (!isPartialSelectionEnabled) {
      return SelectionMode.Full;
    }

    if (shiftKeyPressed && metaKeyPressed) {
      return SelectionMode.Partial;
    }

    return SelectionMode.Full;
  }, [shiftKeyPressed, metaKeyPressed, isPartialSelectionEnabled]);

  return (
    <BlockStack className="h-full w-full">
      <SubgraphBreadcrumbs />
      <ReactFlow
        {...rest}
        nodes={allNodes}
        edges={edges}
        minZoom={0.01}
        maxZoom={3}
        selectionMode={selectionMode}
        onNodesChange={handleOnNodesChange}
        onEdgesChange={onEdgesChange}
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
        onSelectionEnd={handleSelectionEnd}
        nodesConnectable={readOnly ? false : nodesConnectable}
        connectOnClick={!readOnly}
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
      <InputDialog {...inputDialogProps} />
      <ComponentDuplicateDialog
        existingComponent={existingAndNewComponent?.existingComponent}
        newComponent={existingAndNewComponent?.newComponent}
        setClose={handleCancelUpload}
        handleImportComponent={handleImportComponent}
      />
    </BlockStack>
  );
};

export default FlowCanvas;
