import type { Edge, Node } from "@xyflow/react";

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
import type { NodeTypeRegistry } from "@/routes/v2/shared/nodes/registry";
import type { UndoGroupable } from "@/routes/v2/shared/nodes/types";
import type {
  EditorStore,
  NodeEntityType,
  SelectedNode,
} from "@/routes/v2/shared/store/editorStore";
import type { ParentContext } from "@/routes/v2/shared/store/navigationStore";

interface CanvasDeleteContext {
  undo: UndoGroupable;
  spec: ComponentSpec;
  parentContext: ParentContext | null | undefined;
  selectedEdges: Edge[];
  nodeSelection: SelectedNode[];
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
    removeBindingsAndStripConduits(spec, bindingIds, undo);
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

  deleteSelectedNodes(ctx.undo, ctx.spec, nodeSelection, ctx.parentContext);
}

function clearEditorSelectionAfterDelete(editor: EditorStore): void {
  editor.clearSelection();
  editor.clearMultiSelection();
}

const NODE_ENTITY_TYPES = [
  "task",
  "input",
  "output",
  "conduit",
  "flex",
] as const satisfies readonly NodeEntityType[];

function isNodeEntityType(value: string): value is NodeEntityType {
  for (const allowed of NODE_ENTITY_TYPES) {
    if (value === allowed) return true;
  }
  return false;
}

export function getSelectedEdgesFromInstance(
  reactFlowInstance: { getEdges: () => Edge[] } | null,
): Edge[] {
  return reactFlowInstance?.getEdges().filter((e) => e.selected) ?? [];
}

/**
 * Maps React Flow nodes slated for deletion to editor `SelectedNode` shapes
 * using the node registry (same source of truth as `getEffectiveSelection`).
 */
function selectedNodesFromFlowNodes(
  registry: NodeTypeRegistry,
  spec: ComponentSpec,
  nodes: Node[],
): SelectedNode[] {
  const result: SelectedNode[] = [];
  for (const node of nodes) {
    const manifest = registry.getByNodeId(spec, node.id);
    if (!manifest) continue;
    const position = manifest.getPosition(spec, node.id);
    if (!position) continue;
    const entityType = manifest.entityType;
    if (!isNodeEntityType(entityType)) continue;
    result.push({
      id: node.id,
      type: entityType,
      position,
    });
  }
  return result;
}

// --- React Flow delete pipeline (pure handler + caller-owned deps) ---

export interface FlowCanvasDeleteDeps {
  spec: ComponentSpec | null;
  undo: UndoGroupable;
  editor: EditorStore;
  parentContext: ParentContext | null | undefined;
  registry: NodeTypeRegistry;
}

/**
 * Runs spec/undo deletion for the elements React Flow is about to remove, then
 * aborts RF’s internal removal so controlled `nodes`/`edges` stay driven by the spec.
 */
export async function runFlowCanvasOnBeforeDelete(
  { spec, undo, editor, parentContext, registry }: FlowCanvasDeleteDeps,
  {
    nodes,
    edges,
  }: {
    nodes: Node[];
    edges: Edge[];
  },
): Promise<boolean | { nodes: Node[]; edges: Edge[] }> {
  if (!spec) return true;
  if (nodes.length === 0 && edges.length === 0) return true;

  const nodeSelection = selectedNodesFromFlowNodes(registry, spec, nodes);
  if (nodes.length > 0 && nodeSelection.length !== nodes.length) {
    return false;
  }

  applyCanvasDeleteSelection({
    undo,
    spec,
    parentContext,
    selectedEdges: edges,
    nodeSelection,
  });
  clearEditorSelectionAfterDelete(editor);
  return false;
}
