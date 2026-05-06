import type { EdgeChange, NodeChange, ReactFlowProps } from "@xyflow/react";

import type { ComponentSpec } from "@/models/componentSpec";
import { cleanupDeletedBinding } from "@/routes/v2/pages/Editor/nodes/ConduitNode/conduits.actions";
import { deleteEdge } from "@/routes/v2/pages/Editor/store/actions";
import { cleanupAggregatorInputForBinding } from "@/routes/v2/pages/Editor/store/actions/aggregator.actions";
import { useEditorSession } from "@/routes/v2/pages/Editor/store/EditorSessionContext";
import { useNodeRegistry } from "@/routes/v2/shared/nodes/NodeRegistryContext";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

export function useNodeEdgeChanges(
  spec: ComponentSpec | null,
  rfOnNodesChange: (changes: NodeChange[]) => void,
  rfOnEdgesChange: (changes: EdgeChange[]) => void,
): Required<Pick<ReactFlowProps, "onNodesChange" | "onEdgesChange">> {
  const registry = useNodeRegistry();
  const { editor, navigation } = useSharedStores();
  const { undo } = useEditorSession();

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
      undo.withGroup("Move nodes", () => {
        for (const change of positionChanges) {
          if ("id" in change && "position" in change && change.position) {
            const manifest = registry.getByNodeId(spec, change.id);
            manifest?.updatePosition(undo, spec, change.id, change.position);
          }
        }
      });
    }

    const removeChanges = changes.filter((change) => change.type === "remove");
    for (const change of removeChanges) {
      if ("id" in change) {
        const manifest = registry.getByNodeId(spec, change.id);
        // todo: move action to a separate file
        undo.withGroup("Delete node", () => {
          manifest?.deleteNode(undo, spec, change.id, navigation.parentContext);
        });

        // deselect removed nodes
        editor.clearSelection();
        editor.clearMultiSelection();
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
        const bindingIdMatch = edgeId.match(/^edge_(.+)$/);
        const binding = bindingIdMatch
          ? spec.bindings.find((b) => b.$id === bindingIdMatch[1])
          : undefined;
        const aggregatorTarget = binding
          ? {
              targetEntityId: binding.targetEntityId,
              targetPortName: binding.targetPortName,
            }
          : null;

        deleteEdge(undo, spec, edgeId);

        if (bindingIdMatch) {
          // todo: find out how to decouple
          cleanupDeletedBinding(undo, spec, bindingIdMatch[1]);
        }

        if (aggregatorTarget) {
          cleanupAggregatorInputForBinding(undo, spec, aggregatorTarget);
        }
      }
    }

    rfOnEdgesChange(changes);
  };

  return { onNodesChange, onEdgesChange };
}
