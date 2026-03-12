import "../../../nodes"; // ensure manifests are registered

import type { EdgeChange, NodeChange, ReactFlowProps } from "@xyflow/react";

import type { ComponentSpec } from "@/models/componentSpec";

import { cleanupDeletedBinding } from "../../../nodes/ConduitNode/hooks/useConduits";
import { NODE_TYPE_REGISTRY } from "../../../nodes/registry";
import { deleteEdge } from "../../../store/actions";
import { withUndoGroup } from "../../../store/undoStore";

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
      // todo: move action to a separate file
      withUndoGroup("Move nodes", () => {
        for (const change of positionChanges) {
          if ("id" in change && "position" in change && change.position) {
            const manifest = NODE_TYPE_REGISTRY.getByNodeId(change.id);
            manifest?.updatePosition(spec, change.id, change.position);
          }
        }
      });
    }

    const removeChanges = changes.filter((change) => change.type === "remove");
    for (const change of removeChanges) {
      if ("id" in change) {
        const manifest = NODE_TYPE_REGISTRY.getByNodeId(change.id);
        // todo: move action to a separate file
        withUndoGroup("Delete node", () => {
          manifest?.deleteNode(spec, change.id);
        });
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
      if ("id" in change) {
        const edgeId = change.id;
        deleteEdge(spec, edgeId);

        const bindingIdMatch = edgeId.match(/^edge_(.+)$/);
        if (bindingIdMatch) {
          cleanupDeletedBinding(spec, bindingIdMatch[1]);
        }
      }
    }

    rfOnEdgesChange(changes);
  };

  return { onNodesChange, onEdgesChange };
}
