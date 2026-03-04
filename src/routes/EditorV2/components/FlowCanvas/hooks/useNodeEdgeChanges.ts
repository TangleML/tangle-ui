import type { EdgeChange, NodeChange, ReactFlowProps } from "@xyflow/react";

import type { ComponentSpec } from "@/models/componentSpec";

import {
  deleteEdge,
  deleteInput,
  deleteOutput,
  deleteTask,
  getNodeTypeFromId,
  updateNodePosition,
} from "../../../store/actions";
import { undoStore } from "../../../store/undoStore";

export function useNodeEdgeChanges(
  spec: ComponentSpec | null,
  rfOnNodesChange: (changes: NodeChange[]) => void,
  rfOnEdgesChange: (changes: EdgeChange[]) => void,
): Required<Pick<ReactFlowProps, "onNodesChange" | "onEdgesChange">> {
  const onNodesChange = (changes: NodeChange[]) => {
    if (!spec) {
      rfOnNodesChange(changes);
      return;
    }

    const positionChanges = changes.filter(
      (change) => change.type === "position" && change.dragging === false,
    );

    if (positionChanges.length > 0) {
      undoStore.undoManager?.withGroup("Move nodes", () => {
        for (const change of positionChanges) {
          // todo: introduce type guard for change isPositionChange
          if ("id" in change && "position" in change && change.position) {
            updateNodePosition(spec, change.id, change.position);
          }
        }
      });
    }

    const removeChanges = changes.filter((change) => change.type === "remove");
    for (const change of removeChanges) {
      // todo: introduce type guard for change isRemoveChange
      if ("id" in change) {
        const nodeId = change.id;
        const nodeType = getNodeTypeFromId(nodeId);

        // todo: better handling of node types, remove if statements
        if (nodeType === "task") deleteTask(spec, nodeId);
        else if (nodeType === "input") deleteInput(spec, nodeId);
        else if (nodeType === "output") deleteOutput(spec, nodeId);
      }
    }

    rfOnNodesChange(changes);
  };

  const onEdgesChange = (changes: EdgeChange[]) => {
    if (!spec) {
      rfOnEdgesChange(changes);
      return;
    }

    const removeChanges = changes.filter((change) => change.type === "remove");
    for (const change of removeChanges) {
      // todo: introduce type guard for change isRemoveChange
      if ("id" in change) {
        deleteEdge(spec, change.id);
      }
    }

    rfOnEdgesChange(changes);
  };

  return { onNodesChange, onEdgesChange };
}
