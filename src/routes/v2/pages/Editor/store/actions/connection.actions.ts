import type { ComponentSpec } from "@/models/componentSpec";
import type { UndoGroupable } from "@/routes/v2/shared/nodes/types";

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

export function deleteEdge(
  undo: UndoGroupable,
  spec: ComponentSpec,
  edgeId: string,
): boolean {
  const match = edgeId.match(/^edge_(.+)$/);
  if (!match) return false;
  return undo.withGroup("Delete edge", () => spec.deleteEdgeById(match[1]));
}
