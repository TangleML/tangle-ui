import type { EdgeChange, NodeChange, ReactFlowProps } from "@xyflow/react";

import type { ComponentSpec } from "@/models/componentSpec";
import { useEditorSession } from "@/routes/v2/pages/Editor/store/EditorSessionContext";
import { useNodeRegistry } from "@/routes/v2/shared/nodes/NodeRegistryContext";
import type { CollabDragState } from "@/services/collaboration/protocol";

function isMovableEntity(entityType: string | undefined): boolean {
  return (
    entityType === "task" || entityType === "input" || entityType === "output"
  );
}

export function useNodeEdgeChanges(
  spec: ComponentSpec | null,
  rfOnNodesChange: (changes: NodeChange[]) => void,
  rfOnEdgesChange: (changes: EdgeChange[]) => void,
): Required<Pick<ReactFlowProps, "onNodesChange" | "onEdgesChange">> {
  const registry = useNodeRegistry();
  const { undo, collaboration } = useEditorSession();

  const onNodesChange = (changes: NodeChange[]) => {
    const rfChanges = changes.filter((c) => c.type !== "remove");

    if (!spec) {
      rfOnNodesChange(rfChanges);
      return;
    }

    const positionChanges = changes.filter(
      (change) => change.type === "position" && change.dragging === false,
    );

    if (collaboration.enabled) {
      const activeDrags: CollabDragState[] = [];
      for (const change of changes) {
        if (
          change.type !== "position" ||
          !change.dragging ||
          !change.position
        ) {
          continue;
        }
        const manifest = registry.getByNodeId(spec, change.id);
        if (!isMovableEntity(manifest?.entityType)) continue;
        activeDrags.push({
          taskId: change.id,
          position: { x: change.position.x, y: change.position.y },
        });
      }
      if (activeDrags.length > 0) collaboration.updateLocalDrag(activeDrags);
    }

    if (positionChanges.length > 0) {
      // The move runs as a normal action; the collab capture middleware picks it
      // up. Drag previews stay React-Flow-local and broadcast as presence above.
      // todo: move action to a separate file
      undo.withGroup("Move nodes", () => {
        for (const change of positionChanges) {
          if ("id" in change && "position" in change && change.position) {
            const manifest = registry.getByNodeId(spec, change.id);
            manifest?.updatePosition(undo, spec, change.id, change.position);
          }
        }
      });
      if (collaboration.enabled) collaboration.clearLocalDrag();
    }

    rfOnNodesChange(rfChanges);
  };

  // Edge/node deletes go through React Flow (`deleteKeyCode` or `deleteElements`) +
  // `runFlowCanvasOnBeforeDelete` (spec + undo), which aborts RF removal; RF may
  // still emit `remove` changes — drop them so we don't double-apply.
  // `useFlowCanvasState` re-syncs nodes/edges from the spec.
  const onEdgesChange = (changes: EdgeChange[]) => {
    rfOnEdgesChange(changes.filter((c) => c.type !== "remove"));
  };

  return { onNodesChange, onEdgesChange };
}
