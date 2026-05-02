import type { ComponentSpec } from "@/models/componentSpec";
import { stripBindingIdsFromConduitMetadata } from "@/routes/v2/pages/Editor/nodes/ConduitNode/conduits.actions";
import type { UndoGroupable } from "@/routes/v2/shared/nodes/types";

import { cleanupAggregatorInputForBinding } from "./aggregator.actions";
import { getNodeTypeFromId } from "./utils";

interface ConnectionInfo {
  sourceNodeId: string;
  sourceHandleId: string;
  targetNodeId: string;
  targetHandleId: string;
}

export function connectNodes(
  undo: UndoGroupable,
  spec: ComponentSpec,
  connection: ConnectionInfo,
): boolean {
  const { sourceNodeId, sourceHandleId, targetNodeId, targetHandleId } =
    connection;

  const sourceOutputName = sourceHandleId.replace(/^output_/, "");
  const targetInputName = targetHandleId.replace(/^input_/, "");

  const sourceType = getNodeTypeFromId(spec, sourceNodeId);
  const targetType = getNodeTypeFromId(spec, targetNodeId);

  if (sourceType === "input" && targetType === "output") return false;

  return undo.withGroup("Connect nodes", () => {
    spec.connectNodes(
      { entityId: sourceNodeId, portName: sourceOutputName },
      { entityId: targetNodeId, portName: targetInputName },
    );
    return true;
  });
}

export function edgeIdToBindingId(edgeId: string): string | null {
  const match = edgeId.match(/^edge_(.+)$/);
  return match ? match[1] : null;
}

/**
 * Deletes bindings and updates conduit metadata. Caller must wrap in
 * `undo.withGroup` when this should be a single undo step.
 */
export function removeBindingsAndStripConduits(
  spec: ComponentSpec,
  bindingIds: string[],
  undo: UndoGroupable,
): void {
  const unique = [...new Set(bindingIds)];
  if (unique.length === 0) return;

  const aggregatorTargets: Array<{
    targetEntityId: string;
    targetPortName: string;
  }> = [];
  for (const id of unique) {
    const binding = spec.bindings.find((candidate) => candidate.$id === id);
    if (!binding) continue;
    aggregatorTargets.push({
      targetEntityId: binding.targetEntityId,
      targetPortName: binding.targetPortName,
    });
  }

  for (const id of unique) {
    spec.deleteEdgeById(id);
  }
  stripBindingIdsFromConduitMetadata(spec, unique);

  for (const target of aggregatorTargets) {
    cleanupAggregatorInputForBinding(undo, spec, target);
  }
}

export function deleteSelectedEdgesByEdgeIds(
  undo: UndoGroupable,
  spec: ComponentSpec,
  edgeIds: string[],
): void {
  const bindingIds = edgeIds
    .map(edgeIdToBindingId)
    .filter((id): id is string => id !== null);
  if (bindingIds.length === 0) return;
  undo.withGroup("Delete selected edges", () => {
    removeBindingsAndStripConduits(spec, bindingIds, undo);
  });
}
