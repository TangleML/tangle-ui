import { useReactFlow } from "@xyflow/react";
import { useState } from "react";

import addTask from "@/components/shared/ReactFlow/FlowCanvas/utils/addTask";
import { computePlacementPosition } from "@/components/shared/ReactFlow/FlowCanvas/utils/computePlacementPosition";
import type { Bounds } from "@/components/shared/ReactFlow/FlowCanvas/utils/geometry";
import { replaceTaskComponentRef } from "@/components/shared/ReactFlow/FlowCanvas/utils/replaceTaskComponentRef";
import { useNodesOverlay } from "@/components/shared/ReactFlow/NodesOverlay/NodesOverlayProvider";
import useToastNotification from "@/hooks/useToastNotification";
import { useComponentSpec } from "@/providers/ComponentSpecProvider";
import { extractPositionFromAnnotations } from "@/utils/annotations";
import {
  type ComponentSpec,
  type HydratedComponentReference,
  isGraphImplementation,
  type TaskSpec,
} from "@/utils/componentSpec";
import { diffComponentIO } from "@/utils/componentSpecDiff";
import { DEFAULT_NODE_DIMENSIONS } from "@/utils/constants";
import { taskIdToNodeId } from "@/utils/nodes/nodeIdUtils";
import { tracking } from "@/utils/tracking";

import { ActionButton } from "../../Buttons/ActionButton";
import { ComponentEditorDialog } from "../../ComponentEditor/ComponentEditorDialog";
import type { SaveAction } from "../../ComponentEditor/saveAction";
import { SaveActionsView } from "../../ComponentEditor/SaveActionsView";

// Fallback height for nodes that have not been measured yet (e.g. just added).
const ESTIMATED_NODE_HEIGHT = 120;

interface EditComponentButtonProps {
  componentRef: HydratedComponentReference;
  taskId?: string;
}

export const EditComponentButton = ({
  componentRef,
  taskId,
}: EditComponentButtonProps) => {
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const notify = useToastNotification();
  const { currentGraphSpec, updateGraphSpec } = useComponentSpec();
  const { getNodes } = useReactFlow();
  const { fitNodeIntoView, selectNode, notifyNode } = useNodesOverlay();

  const editedTask = taskId ? currentGraphSpec?.tasks[taskId] : undefined;

  const updateInPlace = (hydratedComponent: HydratedComponentReference) => {
    if (!taskId || !currentGraphSpec?.tasks[taskId]) {
      notify(
        "Could not update the component: the edited task was not found.",
        "error",
      );
      return;
    }

    const { updatedGraphSpec, lostInputs } = replaceTaskComponentRef(
      taskId,
      hydratedComponent,
      currentGraphSpec,
    );

    updateGraphSpec(updatedGraphSpec);

    if (lostInputs.length > 0) {
      const inputNames = lostInputs.map((input) => input.name).join(", ");
      notify(
        `Component updated. Removed ${lostInputs.length} input(s) no longer defined: ${inputNames}.`,
        "warning",
      );
    } else {
      notify("Component updated", "success");
    }
  };

  const placeAsNewTask = (hydratedComponent: HydratedComponentReference) => {
    if (!taskId || !editedTask || !currentGraphSpec) {
      notify(
        "Could not place a new task: the edited task was not found.",
        "error",
      );
      return;
    }

    // Anchor on the edited task; avoid overlapping any existing node.
    const nodes = getNodes();
    const toRect = (
      x: number,
      y: number,
      width?: number,
      height?: number,
    ): Bounds => ({
      x,
      y,
      width: width ?? DEFAULT_NODE_DIMENSIONS.w,
      height: height ?? ESTIMATED_NODE_HEIGHT,
    });

    const anchorNodeId = taskIdToNodeId(taskId);
    const anchorNode = nodes.find((node) => node.id === anchorNodeId);
    const anchorPosition = extractPositionFromAnnotations(
      editedTask.annotations,
    );
    const anchorRect = anchorNode
      ? toRect(
          anchorNode.position.x,
          anchorNode.position.y,
          anchorNode.measured?.width,
          anchorNode.measured?.height,
        )
      : toRect(anchorPosition.x, anchorPosition.y);

    const otherRects = nodes
      .filter((node) => node.id !== anchorNodeId)
      .map((node) =>
        toRect(
          node.position.x,
          node.position.y,
          node.measured?.width,
          node.measured?.height,
        ),
      );

    const position = computePlacementPosition(anchorRect, otherRects, {
      prefer: "below",
    });

    const newTaskSpec: TaskSpec = {
      annotations: {},
      componentRef: hydratedComponent,
    };

    // Add to the current (sub)graph, then write it back through the provider.
    const wrapperSpec: ComponentSpec = {
      implementation: { graph: currentGraphSpec },
    };
    const { spec: updatedWrapper, taskId: newTaskId } = addTask(
      "task",
      newTaskSpec,
      position,
      wrapperSpec,
    );

    if (!isGraphImplementation(updatedWrapper.implementation) || !newTaskId) {
      notify("Could not place a new task.", "error");
      return;
    }

    updateGraphSpec(updatedWrapper.implementation.graph);
    notify("Task added", "success");

    // The new node mounts asynchronously; wait for it, then reveal + spotlight.
    const newNodeId = taskIdToNodeId(newTaskId);
    requestAnimationFrame(() => {
      requestAnimationFrame(async () => {
        await fitNodeIntoView(newNodeId);
        selectNode(newNodeId);
        notifyNode(newNodeId, { type: "spotlight" });
      });
    });
  };

  const handleComponentSaved = (
    hydratedComponent: HydratedComponentReference,
    action: SaveAction,
  ) => {
    if (action === "update") {
      updateInPlace(hydratedComponent);
    } else if (action === "place") {
      placeAsNewTask(hydratedComponent);
    }
  };

  return (
    <>
      <ActionButton
        tooltip="Edit Component Definition"
        icon="FilePenLine"
        onClick={() => setIsEditDialogOpen(true)}
        {...tracking("pipeline_editor.task_node.edit_component")}
      />
      {isEditDialogOpen && (
        <ComponentEditorDialog
          text={componentRef.text}
          onClose={() => setIsEditDialogOpen(false)}
          onComponentSaved={taskId ? handleComponentSaved : undefined}
          renderSaveActions={
            taskId
              ? ({ hydratedComponent, onChoose }) => {
                  const { inputDiff, outputDiff } = diffComponentIO(
                    editedTask?.componentRef.spec,
                    hydratedComponent.spec,
                  );
                  return (
                    <SaveActionsView
                      taskName={componentRef.name}
                      inputDiff={inputDiff}
                      outputDiff={outputDiff}
                      allowPlace
                      onChoose={onChoose}
                    />
                  );
                }
              : undefined
          }
        />
      )}
    </>
  );
};
