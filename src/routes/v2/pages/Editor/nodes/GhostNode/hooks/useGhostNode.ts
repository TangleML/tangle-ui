import type { Edge, Node, XYPosition } from "@xyflow/react";
import { useConnection } from "@xyflow/react";
import type { Handle } from "@xyflow/system";

import type { ComponentSpec, ComponentSpecJson } from "@/models/componentSpec";
import {
  GHOST_HANDLE_ID,
  GHOST_NODE_ID,
  type GhostNodeData,
} from "@/routes/v2/pages/Editor/nodes/GhostNode/components/GhostNode";

interface UseGhostNodeParams {
  active: boolean;
  isConnecting: boolean;
  spec: ComponentSpec | null;
}

interface UseGhostNodeReturn {
  ghostNode: Node<GhostNodeData> | null;
  ghostEdge: Edge | null;
}

function extractPortName(handleId: string, ioType: "input" | "output"): string {
  return ioType === "input"
    ? handleId.replace(/^input_/, "")
    : handleId.replace(/^output_/, "");
}

function lookupPortType(
  componentSpec: ComponentSpecJson | undefined,
  portName: string,
  ioType: "input" | "output",
): string | undefined {
  if (!componentSpec) return undefined;
  const specs =
    ioType === "input" ? componentSpec.inputs : componentSpec.outputs;
  const portSpec = specs?.find((s) => s.name === portName);
  if (!portSpec?.type) return undefined;
  return typeof portSpec.type === "string"
    ? portSpec.type
    : JSON.stringify(portSpec.type);
}

function buildGhostNode(
  position: XYPosition,
  fromHandle: Handle,
  spec: ComponentSpec,
): Node<GhostNodeData> {
  const isInputConnection = fromHandle.type === "target";
  const ioType: GhostNodeData["ioType"] = isInputConnection
    ? "input"
    : "output";

  const handleId = fromHandle.id ?? "";
  const portName = extractPortName(handleId, ioType);

  const task = spec.tasks.find((t) => t.$id === fromHandle.nodeId);
  const taskComponentSpec = task?.resolvedComponentSpec;
  const dataType = lookupPortType(taskComponentSpec, portName, ioType);

  return {
    id: GHOST_NODE_ID,
    type: "ghost" as const,
    position,
    data: { ioType, label: portName, dataType },
    draggable: false,
    selectable: false,
    deletable: false,
    connectable: false,
    focusable: false,
    zIndex: 1000,
  };
}

function buildGhostEdge(fromHandle: Handle): Edge {
  const isFromSource = fromHandle.type === "source";
  return {
    id: "ghost-edge",
    source: isFromSource ? fromHandle.nodeId : GHOST_NODE_ID,
    sourceHandle: isFromSource ? fromHandle.id : GHOST_HANDLE_ID,
    target: isFromSource ? GHOST_NODE_ID : fromHandle.nodeId,
    targetHandle: isFromSource ? GHOST_HANDLE_ID : fromHandle.id,
    style: {
      stroke: isFromSource ? "#4ade80" : "#60a5fa",
      strokeWidth: 4,
      strokeDasharray: "5,5",
      strokeOpacity: 0.5,
    },
    animated: true,
  };
}

function isTemporarilyValid(
  connectionIsValid: boolean | null,
  connectionToHandle: Handle | null,
): boolean {
  return (
    connectionIsValid === true &&
    !!connectionToHandle &&
    connectionToHandle.nodeId !== GHOST_NODE_ID
  );
}

function shouldShowGhostNode(
  active: boolean,
  isConnecting: boolean,
  connectionPosition: XYPosition | null,
  connectionFromHandle: Handle | null,
  connectionFromNodeType: string | undefined,
  temporarilyValid: boolean,
  spec: ComponentSpec | null,
): spec is ComponentSpec {
  return (
    active &&
    isConnecting &&
    !!connectionPosition &&
    !!connectionFromHandle &&
    connectionFromNodeType === "task" &&
    !!connectionFromHandle.type &&
    !temporarilyValid &&
    !!spec
  );
}

export function useGhostNode({
  active,
  isConnecting,
  spec,
}: UseGhostNodeParams): UseGhostNodeReturn {
  const connectionPosition = useConnection((c) => c.to);
  const connectionFromHandle = useConnection((c) => c.fromHandle);
  const connectionFromNode = useConnection((c) => c.fromNode);
  const connectionToHandle = useConnection((c) => c.toHandle);
  const connectionIsValid = useConnection((c) => c.isValid);

  const temporarilyValid = isTemporarilyValid(
    connectionIsValid,
    connectionToHandle,
  );

  if (
    !shouldShowGhostNode(
      active,
      isConnecting,
      connectionPosition,
      connectionFromHandle,
      connectionFromNode?.type,
      temporarilyValid,
      spec,
    )
  ) {
    return { ghostNode: null, ghostEdge: null };
  }

  // Guaranteed non-null by shouldShowGhostNode guard above
  const position = connectionPosition!;
  const fromHandle = connectionFromHandle!;

  const ghostNode = buildGhostNode(position, fromHandle, spec);
  const ghostEdge = buildGhostEdge(fromHandle);
  return { ghostNode, ghostEdge };
}
