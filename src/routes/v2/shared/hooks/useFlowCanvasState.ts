import type { Edge, Node, OnEdgesChange, OnNodesChange } from "@xyflow/react";
import { SelectionMode, useEdgesState, useNodesState } from "@xyflow/react";
import { autorun, untracked } from "mobx";
import { useEffect } from "react";

import type { ComponentSpec } from "@/models/componentSpec";
import { useNodeRegistry } from "@/routes/v2/shared/nodes/NodeRegistryContext";
import { useEdgeSelectionHighlightOverlay } from "@/routes/v2/shared/overlays/edgeSelectionHighlight/useEdgeSelectionHighlightOverlay";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

import { useCanvasEnhancements } from "./useCanvasEnhancements";

interface UseFlowCanvasStateParams {
  spec: ComponentSpec | null;
  metaKeyPressed?: boolean;
  isConnecting?: boolean;
}

/** The document owns graph content; React Flow owns transient geometry. */
export function useFlowCanvasState({
  spec,
  metaKeyPressed = false,
  isConnecting = false,
}: UseFlowCanvasStateParams) {
  const registry = useNodeRegistry();
  const { editor, canvasOverlay } = useSharedStores();
  const [nodes, setNodes, updateNodes] = useNodesState<Node>([]);
  const [edges, setEdges, updateEdges] = useEdgesState<Edge>([]);

  useEffect(() => {
    if (!spec) {
      setNodes([]);
      setEdges([]);
      return;
    }
    return autorun(() => {
      const nextNodes = registry.buildAllNodes(spec);
      const nextEdges = registry.buildAllEdges(spec);
      setNodes(nextNodes);
      setEdges(nextEdges);
      // Selection cannot keep entities removed by undo, grouping, or tools.
      // Do not make selection changes rebuild transient drag geometry.
      untracked(() => {
        const nodeIds = new Set(nextNodes.map((node) => node.id));
        const edgeIds = new Set(nextEdges.map((edge) => edge.id));
        editor.setSelectedNodes(
          editor.selectedNodes.filter((node) => nodeIds.has(node.id)),
        );
        editor.setSelectedEdges(
          editor.selectedEdgeIds.filter((id) => edgeIds.has(id)),
        );
      });
    });
  }, [spec, registry, editor, setNodes, setEdges]);

  const rfOnNodesChange: OnNodesChange = (changes) => {
    const selectionChanges = changes.filter(
      (change) => change.type === "select",
    );
    if (selectionChanges.length > 0) {
      const selected = new Map(
        editor.selectedNodes.map((node) => [node.id, node]),
      );
      for (const change of selectionChanges) {
        if (!change.selected) {
          selected.delete(change.id);
          continue;
        }
        const node = nodes.find((item) => item.id === change.id);
        const manifest = registry.getByNodeId(spec, change.id);
        const item =
          node && manifest?.selectable ? manifest.toSelectedNode?.(node) : null;
        if (item) selected.set(change.id, item);
      }
      editor.setSelectedNodes([...selected.values()]);
    }
    updateNodes(changes.filter((change) => change.type !== "select"));
  };

  const rfOnEdgesChange: OnEdgesChange = (changes) => {
    const selectionChanges = changes.filter(
      (change) => change.type === "select",
    );
    if (selectionChanges.length > 0) {
      const selected = new Set(editor.selectedEdgeIds);
      for (const change of selectionChanges) {
        if (change.selected) selected.add(change.id);
        else selected.delete(change.id);
      }
      editor.setSelectedEdges([...selected]);
    }
    updateEdges(changes.filter((change) => change.type !== "select"));
  };

  const selectedNodeIds = new Set(editor.selectedNodes.map((node) => node.id));
  const selectedEdgeIds = new Set(editor.selectedEdgeIds);
  const selectedNodes = nodes.map((node) => ({
    ...node,
    selected: selectedNodeIds.has(node.id),
  }));
  const selectedEdges = edges.map((edge) => ({
    ...edge,
    selected: selectedEdgeIds.has(edge.id),
  }));
  const {
    nodes: displayNodes,
    edges: displayEdges,
    onEdgeClick,
  } = useCanvasEnhancements(
    registry,
    {
      spec,
      nodes: selectedNodes,
      edges: selectedEdges,
      metaKeyPressed,
      isConnecting,
    },
    canvasOverlay,
  );

  useEdgeSelectionHighlightOverlay(selectedNodes, selectedEdges);

  return {
    displayNodes,
    displayEdges,
    onEdgeClick,
    rfOnNodesChange,
    rfOnEdgesChange,
    selectionBehavior: {
      selectionMode: metaKeyPressed
        ? SelectionMode.Partial
        : SelectionMode.Full,
    },
  };
}
