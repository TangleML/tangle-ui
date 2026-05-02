import type { Edge, ReactFlowInstance } from "@xyflow/react";
import { useEffect } from "react";

import type { ComponentSpec } from "@/models/componentSpec";
import {
  deleteSelectedEdgesByEdgeIds,
  edgeIdToBindingId,
  removeBindingsAndStripConduits,
} from "@/routes/v2/pages/Editor/store/actions/connection.actions";
import {
  deleteSelectedNodes,
  deleteSelectedNodesCore,
} from "@/routes/v2/pages/Editor/store/actions/task.actions";
import { useEditorSession } from "@/routes/v2/pages/Editor/store/EditorSessionContext";
import { getEffectiveSelection } from "@/routes/v2/shared/clipboard/getEffectiveSelection";
import { useNodeRegistry } from "@/routes/v2/shared/nodes/NodeRegistryContext";
import type { UndoGroupable } from "@/routes/v2/shared/nodes/types";
import { BACKSPACE, DELETE } from "@/routes/v2/shared/shortcuts/keys";
import type {
  EditorStore,
  SelectedNode,
} from "@/routes/v2/shared/store/editorStore";
import type { ParentContext } from "@/routes/v2/shared/store/navigationStore";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

function getSelectedEdges(reactFlowInstance: ReactFlowInstance | null): Edge[] {
  return reactFlowInstance?.getEdges().filter((e) => e.selected) ?? [];
}

function bindingIdsFromEdges(edges: Edge[]): string[] {
  return edges
    .map((e) => edgeIdToBindingId(e.id))
    .filter((id): id is string => id !== null);
}

function deleteMixedEdgeAndNodeSelection(
  undo: UndoGroupable,
  spec: ComponentSpec,
  selectedEdges: Edge[],
  nodeSelection: SelectedNode[],
  parentContext: ParentContext | null | undefined,
): void {
  const bindingIds = bindingIdsFromEdges(selectedEdges);
  undo.withGroup("Delete selection", () => {
    removeBindingsAndStripConduits(spec, bindingIds);
    deleteSelectedNodesCore(undo, spec, nodeSelection, parentContext);
  });
}

function deleteEdgesOnlySelection(
  undo: UndoGroupable,
  spec: ComponentSpec,
  selectedEdges: Edge[],
): void {
  deleteSelectedEdgesByEdgeIds(
    undo,
    spec,
    selectedEdges.map((e) => e.id),
  );
}

function deleteNodesOnlySelection(
  undo: UndoGroupable,
  spec: ComponentSpec,
  nodeSelection: SelectedNode[],
  parentContext: ParentContext | null | undefined,
): void {
  deleteSelectedNodes(undo, spec, nodeSelection, parentContext);
}

interface CanvasDeleteContext {
  undo: UndoGroupable;
  spec: ComponentSpec;
  parentContext: ParentContext | null | undefined;
  selectedEdges: Edge[];
  nodeSelection: SelectedNode[];
}

function applyCanvasDeleteSelection(ctx: CanvasDeleteContext): void {
  const { selectedEdges, nodeSelection } = ctx;

  if (selectedEdges.length > 0 && nodeSelection.length > 0) {
    deleteMixedEdgeAndNodeSelection(
      ctx.undo,
      ctx.spec,
      selectedEdges,
      nodeSelection,
      ctx.parentContext,
    );
    return;
  }

  if (selectedEdges.length > 0) {
    deleteEdgesOnlySelection(ctx.undo, ctx.spec, selectedEdges);
    return;
  }

  deleteNodesOnlySelection(
    ctx.undo,
    ctx.spec,
    nodeSelection,
    ctx.parentContext,
  );
}

function clearEditorSelectionAfterDelete(editor: EditorStore): void {
  editor.clearSelection();
  editor.clearMultiSelection();
}

const CANVAS_DELETE_SHORTCUTS = [
  { id: "canvas-delete-delete" as const, keys: [DELETE] as const },
  { id: "canvas-delete-backspace" as const, keys: [BACKSPACE] as const },
];

export function useCanvasDeleteShortcuts(
  spec: ComponentSpec | null,
  reactFlowInstance: ReactFlowInstance | null,
): void {
  const registry = useNodeRegistry();
  const { editor, keyboard, navigation } = useSharedStores();
  const { undo } = useEditorSession();

  useEffect(() => {
    const runDelete = () => {
      if (!spec) return;

      const selectedEdges = getSelectedEdges(reactFlowInstance);
      const nodeSelection = getEffectiveSelection(registry, spec, editor);

      if (selectedEdges.length === 0 && nodeSelection.length === 0) return;

      applyCanvasDeleteSelection({
        undo,
        spec,
        parentContext: navigation.parentContext,
        selectedEdges,
        nodeSelection,
      });
      clearEditorSelectionAfterDelete(editor);
    };

    const unregisters = CANVAS_DELETE_SHORTCUTS.map(({ id, keys }) =>
      keyboard.registerShortcut({
        id,
        keys: [...keys],
        label: "Delete selection",
        action: (e) => {
          e.preventDefault();
          runDelete();
        },
      }),
    );

    return () => {
      for (const unregister of unregisters) {
        unregister();
      }
    };
  }, [
    editor,
    keyboard,
    navigation.parentContext,
    reactFlowInstance,
    registry,
    spec,
    undo,
  ]);
}
