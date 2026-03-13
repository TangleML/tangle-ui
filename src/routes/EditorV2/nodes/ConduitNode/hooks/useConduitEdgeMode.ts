import type { Edge } from "@xyflow/react";
import { useEffect } from "react";

import type { ComponentSpec } from "@/models/componentSpec";

import { ESCAPE } from "../../../shortcuts/keys";
import { clearSelection, editorStore } from "../../../store/editorStore";
import { registerShortcut } from "../../../store/keyboardStore";
import { getConduits, toggleEdgeOnConduit } from "../conduits.actions";

function useConduitSelectionMode(edges: Edge[], spec: ComponentSpec | null) {
  const isConduitSelected = editorStore.selectedNodeType === "conduit";
  const activeConduitId = isConduitSelected ? editorStore.selectedNodeId : null;

  if (!activeConduitId || !spec) return edges;

  const activeConduit = getConduits(spec).find((c) => c.id === activeConduitId);
  if (!activeConduit) return edges;

  const assignedBindingIds = new Set(activeConduit.edgeIds);
  const conduitColor = activeConduit.color;

  return edges.map((edge) => {
    const bindingIdMatch = edge.id.match(/^edge_(.+)$/);
    const bindingId = bindingIdMatch?.[1];
    const isAssigned = bindingId ? assignedBindingIds.has(bindingId) : false;

    if (isAssigned) {
      return {
        ...edge,
        style: { ...edge.style, stroke: conduitColor, strokeWidth: 3 },
        data: {
          ...edge.data,
          isInAssignmentMode: true,
          isAssignedToActiveConduit: true,
          activeConduitColor: conduitColor,
        },
      };
    }

    return {
      ...edge,
      style: { ...edge.style, opacity: 0.25 },
      data: {
        ...edge.data,
        isInAssignmentMode: true,
        isAssignedToActiveConduit: false,
      },
    };
  });
}

/**
 * Encapsulates conduit-specific canvas behaviour:
 * - styles edges when a conduit is selected (assignment-mode highlighting)
 * - provides an `onEdgeClick` handler that toggles edge assignment
 * - registers an Escape-key shortcut that deselects the conduit
 */
export function useConduitEdgeMode(
  edges: Edge[],
  spec: ComponentSpec | null,
): {
  edges: Edge[];
  onEdgeClick:
    | ((event: React.MouseEvent, edge: { id: string }) => void)
    | undefined;
} {
  const isConduitSelected = editorStore.selectedNodeType === "conduit";

  useEffect(() => {
    const unregister = registerShortcut({
      id: "conduit-escape",
      keys: [ESCAPE],
      label: "Deselect conduit",
      action: () => {
        if (
          editorStore.selectedNodeType === "conduit" &&
          editorStore.selectedNodeId
        ) {
          clearSelection();
        }
      },
    });

    return unregister;
  }, []);

  const styledEdges = useConduitSelectionMode(edges, spec);

  const handleEdgeClick = (_event: React.MouseEvent, edge: { id: string }) => {
    if (!spec) return;

    const bindingMatch = edge.id.match(/^edge_(.+)$/);
    if (!bindingMatch) return;
    const bindingId = bindingMatch[1];

    const conduitId = editorStore.selectedNodeId;
    if (!conduitId || editorStore.selectedNodeType !== "conduit") return;

    toggleEdgeOnConduit(spec, conduitId, bindingId);
  };

  return {
    edges: styledEdges,
    onEdgeClick: isConduitSelected ? handleEdgeClick : undefined,
  };
}
