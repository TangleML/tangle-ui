import {
  Background,
  ReactFlow,
  type ReactFlowInstance,
  useConnection,
  useReactFlow,
  type XYPosition,
} from "@xyflow/react";
import { observer } from "mobx-react-lite";
import { useEffect, useState } from "react";

import { YAML_FILE_ACCEPT } from "@/components/shared/FilePicker/fileChecks";
import { FileDropHighlight } from "@/components/shared/FilePicker/FileDropHighlight";
import { FilePickerStatus } from "@/components/shared/FilePicker/FilePickerStatus";
import {
  type PickOutcome,
  useFilePicker,
} from "@/components/shared/FilePicker/useFilePicker";
import { BlockStack } from "@/components/ui/layout";
import { cn } from "@/lib/utils";
import type { ComponentSpec } from "@/models/componentSpec";
import { useAutoLayout } from "@/routes/v2/pages/Editor/hooks/useAutoLayout";
import { SubgraphBreadcrumbs } from "@/routes/v2/shared/components/SubgraphBreadcrumbs";
import { FLOW_CANVAS_DEFAULT_PROPS } from "@/routes/v2/shared/flowCanvasDefaults";
import { useDoubleClickBehavior } from "@/routes/v2/shared/hooks/useDoubleClickBehavior";
import { useFitViewOnFocus } from "@/routes/v2/shared/hooks/useFitViewOnFocus";
import { useFitViewOnRequest } from "@/routes/v2/shared/hooks/useFitViewOnRequest";
import { useFlowCanvasState } from "@/routes/v2/shared/hooks/useFlowCanvasState";
import { focusModeStore } from "@/routes/v2/shared/hooks/useFocusMode";
import { useIsDetailedView } from "@/routes/v2/shared/hooks/useIsDetailedView";
import { useViewportScaling } from "@/routes/v2/shared/hooks/useViewportScaling";
import { useNodeRegistry } from "@/routes/v2/shared/nodes/NodeRegistryContext";
import { CMD_OR_CTRL, SHIFT } from "@/routes/v2/shared/shortcuts/keys";
import { isEditableTarget } from "@/routes/v2/shared/shortcuts/shortcutUtils";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

import { CanvasUndoRedo } from "./components/CanvasUndoRedo";
import { ConnectionLine } from "./components/ConnectionLine";
import { FloatingSelectionToolbar } from "./components/FloatingSelectionToolbar";
import { useClipboardShortcuts } from "./hooks/useClipboardShortcuts";
import { useConnectionBehavior } from "./hooks/useConnectionBehavior";
import { useDropBehavior } from "./hooks/useDropBehavior";
import { useFileDropHandler } from "./hooks/useFileDropHandler";
import { useFlowCanvasOnBeforeDelete } from "./hooks/useFlowCanvasOnBeforeDelete";
import { useNodeEdgeChanges } from "./hooks/useNodeEdgeChanges";
import { usePaneClickBehavior } from "./hooks/usePaneClickBehavior";

interface FlowCanvasProps {
  spec: ComponentSpec | null;
  className?: string;
  readOnly?: boolean;
}

const MISSING_DROP_POSITION_OUTCOME: PickOutcome = {
  status: "error",
  message: "The drop position could not be read.",
};

export const FlowCanvas = observer(function FlowCanvas({
  spec,
  className,
  readOnly = false,
}: FlowCanvasProps) {
  const registry = useNodeRegistry();
  const nodeTypes = registry.getNodeTypes();
  const edgeTypes = registry.getEdgeTypes();
  const { keyboard, editor } = useSharedStores();
  const { containerRef, handleViewportChange } = useViewportScaling();
  const [reactFlowInstance, setReactFlowInstance] =
    useState<ReactFlowInstance | null>(null);
  const focusModeActive = focusModeStore.active;

  const metaKeyPressed = keyboard.pressed.has(CMD_OR_CTRL);
  const shiftKeyPressed = keyboard.pressed.has(SHIFT);
  const isConnecting = useConnection((c) => c.inProgress);
  const isDetailedView = useIsDetailedView();

  const {
    displayNodes,
    displayEdges,
    onEdgeClick,
    rfOnNodesChange,
    rfOnEdgesChange,
    selectionBehavior,
  } = useFlowCanvasState({ spec, metaKeyPressed, isConnecting });

  const onBeforeDelete = useFlowCanvasOnBeforeDelete(spec);

  useFitViewOnFocus();
  useFitViewOnRequest();
  useAutoLayout(spec);
  useClipboardShortcuts(spec, containerRef, reactFlowInstance);

  const nodeEdgeBehavior = useNodeEdgeChanges(
    spec,
    rfOnNodesChange,
    rfOnEdgesChange,
  );
  const connectionBehavior = useConnectionBehavior(spec, reactFlowInstance);
  const { flowToScreenPosition } = useReactFlow();
  const fileDropHandler = useFileDropHandler(spec);
  const picker = useFilePicker<{ position: XYPosition }>({
    accept: YAML_FILE_ACCEPT,
    onFile: ({ text, file, meta, isStale }) =>
      meta
        ? fileDropHandler({ file, text, position: meta.position, isStale })
        : MISSING_DROP_POSITION_OUTCOME,
    disabled: readOnly,
    guardWindowDrop: !readOnly,
  });
  const [fileDropAnchor, setFileDropAnchor] = useState<XYPosition>();

  const handleFileDrop = (files: FileList, meta: { position: XYPosition }) => {
    const screenPoint = flowToScreenPosition(meta.position);
    const containerRect = containerRef.current?.getBoundingClientRect();
    setFileDropAnchor({
      x: screenPoint.x - (containerRect?.left ?? 0),
      y: screenPoint.y - (containerRect?.top ?? 0),
    });
    void picker.handleFiles(files, "drop", meta);
  };

  const isStatusVisible = picker.status.kind !== "idle";
  const { dismissStatus } = picker;
  useEffect(() => {
    if (!isStatusVisible) return;
    const dismissStatusOnEscape = (event: KeyboardEvent) => {
      const container = containerRef.current;
      if (event.key !== "Escape" || isEditableTarget(event) || !container) {
        return;
      }
      const { target } = event;
      const isForThisCanvas =
        target === document.body ||
        (target instanceof Node && container.contains(target));
      // Workarea tabs stay mounted while hidden, so a hidden canvas must leave the key alone.
      if (!isForThisCanvas || container.checkVisibility?.() === false) return;
      // Capture phase runs before the editor's window Escape shortcut, so it never sees this key.
      event.stopPropagation();
      dismissStatus();
    };
    window.addEventListener("keydown", dismissStatusOnEscape, true);
    return () =>
      window.removeEventListener("keydown", dismissStatusOnEscape, true);
  }, [isStatusVisible, dismissStatus, containerRef]);

  const dropBehavior = useDropBehavior(spec, reactFlowInstance, {
    onFileDrop: handleFileDrop,
  });
  const doubleClickBehavior = useDoubleClickBehavior(spec);
  const paneClickBehavior = usePaneClickBehavior(spec, reactFlowInstance);

  return (
    <BlockStack
      ref={containerRef}
      fill
      className={cn(
        "relative select-none",
        focusModeActive && "ring-2 ring-blue-500",
        className,
      )}
    >
      <SubgraphBreadcrumbs />
      <ReactFlow
        {...FLOW_CANVAS_DEFAULT_PROPS}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        nodes={displayNodes}
        edges={displayEdges}
        nodesConnectable={isDetailedView}
        edgesReconnectable={isDetailedView}
        {...selectionBehavior}
        {...nodeEdgeBehavior}
        {...connectionBehavior}
        {...dropBehavior}
        {...doubleClickBehavior}
        {...paneClickBehavior}
        onDragEnter={picker.dropTargetProps.onDragEnter}
        onDragLeave={picker.dropTargetProps.onDragLeave}
        onDropCapture={picker.reset}
        onEdgeClick={onEdgeClick}
        onPointerDownCapture={() => {
          editor.setDraggedSincePointerDown(false);
          picker.dismissStatus();
        }}
        onNodeDragStart={() => editor.setDraggedSincePointerDown(true)}
        onNodeClick={() => editor.requestContextPanelReveal()}
        onInit={setReactFlowInstance}
        onViewportChange={handleViewportChange}
        onBeforeDelete={onBeforeDelete}
        connectionLineComponent={ConnectionLine}
        deleteKeyCode={["Delete", "Backspace"]}
        className={cn(
          shiftKeyPressed && !isConnecting && "cursor-crosshair",
          !isDetailedView && "connections-disabled",
        )}
      >
        <FloatingSelectionToolbar spec={spec} />
        <Background gap={10} className="bg-canvas!" />
      </ReactFlow>
      <FileDropHighlight
        isDragging={picker.isDragging}
        message="Drop to add this component"
      />
      <FilePickerStatus
        placement="floating"
        anchor={fileDropAnchor}
        status={picker.status}
        onDismiss={picker.dismissStatus}
        dismissible
      />
      <CanvasUndoRedo />
    </BlockStack>
  );
});
