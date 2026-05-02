import type { EdgeChange, NodeChange, ReactFlowProps } from "@xyflow/react";

import type { ComponentSpec } from "@/models/componentSpec";
import { useEditorSession } from "@/routes/v2/pages/Editor/store/EditorSessionContext";
import { useNodeRegistry } from "@/routes/v2/shared/nodes/NodeRegistryContext";

export function useNodeEdgeChanges(
  spec: ComponentSpec | null,
  rfOnNodesChange: (changes: NodeChange[]) => void,
  rfOnEdgesChange: (changes: EdgeChange[]) => void,
): Required<Pick<ReactFlowProps, "onNodesChange" | "onEdgesChange">> {
  const registry = useNodeRegistry();
  const { undo } = useEditorSession();

  const onNodesChange = (changes: NodeChange[]) => {
    const rfChanges = changes.filter((c) => c.type !== "remove");

    if (!spec) {
      rfOnNodesChange(rfChanges);
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

    rfOnNodesChange(rfChanges);
  };

  const onEdgesChange = (changes: EdgeChange[]) => {
    const rfChanges = changes.filter((c) => c.type !== "remove");

    if (!spec) {
      rfOnEdgesChange(rfChanges);
      return;
    }

    rfOnEdgesChange(rfChanges);
  };

  return { onNodesChange, onEdgesChange };
}
