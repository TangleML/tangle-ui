import type { Node, ReactFlowInstance, XYPosition } from "@xyflow/react";
import { useRef } from "react";

import { isPositionInNode } from "@/components/shared/ReactFlow/FlowCanvas/utils/geometry";
import type { ComponentSpec } from "@/models/componentSpec";
import { useDialog } from "@/providers/DialogProvider/hooks/useDialog";
import { convertCancelErrorTo } from "@/providers/DialogProvider/utils";
import { ReplaceConfirmationDialog } from "@/routes/v2/pages/Editor/components/FlowCanvas/components/ReplaceConfirmationDialog";
import { computeDiffComponentSpecs } from "@/routes/v2/pages/Editor/store/actions/task.utils";
import { useTaskActions } from "@/routes/v2/pages/Editor/store/actions/useTaskActions";
import type { CanvasOverlayConfig } from "@/routes/v2/shared/store/canvasOverlay.types";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";
import { hydrateComponentReference } from "@/services/componentService";
import type { TaskSpec } from "@/utils/componentSpec";

const OVERLAY_ID = "replace-drop-target";
const REPLACEABLE_NODE_TYPE = "task";

function buildHighlightOverlay(targetEntityId: string): CanvasOverlayConfig {
  return {
    id: OVERLAY_ID,
    resolveNodeEffect: (nodeId) => {
      if (nodeId === targetEntityId) {
        return { className: "ring-2 ring-blue-400 rounded-xl" };
      }
      return undefined;
    },
  };
}

/**
 * Find the first task node whose bounding box contains `position`.
 * Returns the node's `data.entityId` or `null` if no match.
 */
function findTaskNodeAtPosition(
  nodes: Node[],
  position: XYPosition,
): { entityId: string; nodeId: string } | null {
  for (const node of nodes) {
    if (node.type !== REPLACEABLE_NODE_TYPE) continue;
    if (!isPositionInNode(node, position)) continue;

    const entityId = (node.data as { entityId?: string }).entityId;
    if (entityId) return { entityId, nodeId: node.id };
  }
  return null;
}

export function useReplaceDropHandler(
  spec: ComponentSpec | null,
  reactFlowInstance: ReactFlowInstance | null,
) {
  const { canvasOverlay } = useSharedStores();
  const { replaceTask } = useTaskActions();
  const { open: openDialog } = useDialog();

  const replaceTargetRef = useRef<string | null>(null);

  const activateOverlay = (entityId: string) => {
    canvasOverlay.activate(buildHighlightOverlay(entityId));
  };

  const deactivateOverlay = () => {
    canvasOverlay.deactivateById(OVERLAY_ID);
  };

  /**
   * Call from `onDragOver` to detect and highlight the task node under the cursor.
   * Pass `null` to clear any active highlight (e.g. file drags, missing instance).
   */
  const detectReplaceTarget = (position: XYPosition | null) => {
    if (!reactFlowInstance || !position) {
      replaceTargetRef.current = null;
      deactivateOverlay();
      return;
    }

    const nodes = reactFlowInstance.getNodes();
    const hit = findTaskNodeAtPosition(nodes, position);

    const newEntityId = hit?.entityId ?? null;

    if (newEntityId === replaceTargetRef.current) return;

    replaceTargetRef.current = newEntityId;

    if (newEntityId) {
      activateOverlay(newEntityId);
    } else {
      deactivateOverlay();
    }
  };

  /**
   * Capture and clear the current replace target.
   * Call once at the start of `onDrop` so the overlay is always cleaned up.
   */
  const flushReplaceState = (): string | null => {
    const targetEntityId = replaceTargetRef.current;
    replaceTargetRef.current = null;
    deactivateOverlay();
    return targetEntityId;
  };

  /**
   * Perform the task replacement for a previously flushed target.
   * Accepts nullable types for defensive typing — predicates gate entry,
   * but TypeScript can't narrow across `switch` cases.
   */
  const performReplaceDrop = async (
    targetEntityId: string | null,
    droppedTaskSpec: TaskSpec | undefined,
  ): Promise<void> => {
    if (!targetEntityId || !droppedTaskSpec || !spec) return;

    const componentRef = await hydrateComponentReference(
      droppedTaskSpec.componentRef,
    );
    if (!componentRef) return;

    const newComponentRef = componentRef;

    const task = spec.tasks.find((t) => t.$id === targetEntityId);
    if (!task) return;

    const { inputDiff, outputDiff } = computeDiffComponentSpecs(
      task.resolvedComponentSpec,
      newComponentRef.spec,
    );

    const hasBreakingChanges =
      inputDiff.lostEntities.length > 0 || outputDiff.lostEntities.length > 0;

    const canReplace = hasBreakingChanges
      ? await openDialog({
          component: ReplaceConfirmationDialog,
          props: {
            taskName: task.name,
            newComponentName: newComponentRef.name,
            inputDiff,
            outputDiff,
          },
        }).catch(convertCancelErrorTo(false))
      : true;

    if (!canReplace) return;

    replaceTask(spec, targetEntityId, newComponentRef);
  };

  return {
    detectReplaceTarget,
    flushReplaceState,
    performReplaceDrop,
  };
}
