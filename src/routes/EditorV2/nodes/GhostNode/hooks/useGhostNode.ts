import type { Edge, Node } from "@xyflow/react";
import { useConnection } from "@xyflow/react";

import type { ComponentSpec, ComponentSpecJson } from "@/models/componentSpec";
import {
  GHOST_HANDLE_ID,
  GHOST_NODE_ID,
  type GhostNodeData,
} from "@/routes/EditorV2/nodes/GhostNode/components/GhostNode";

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

  if (ioType === "input") {
    const inputSpec = componentSpec.inputs?.find((i) => i.name === portName);
    return typeof inputSpec?.type === "string"
      ? inputSpec.type
      : inputSpec?.type
        ? JSON.stringify(inputSpec.type)
        : undefined;
  }

  const outputSpec = componentSpec.outputs?.find((o) => o.name === portName);
  return typeof outputSpec?.type === "string"
    ? outputSpec.type
    : outputSpec?.type
      ? JSON.stringify(outputSpec.type)
      : undefined;
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

  const isConnectionTemporarilyValid =
    connectionIsValid === true &&
    !!connectionToHandle &&
    connectionToHandle.nodeId !== GHOST_NODE_ID;

  let ghostNode: Node<GhostNodeData> | null = null;

  if (
    active &&
    isConnecting &&
    connectionPosition &&
    connectionFromHandle &&
    connectionFromNode?.type === "task" &&
    connectionFromHandle.type &&
    !isConnectionTemporarilyValid &&
    spec
  ) {
    const isInputConnection = connectionFromHandle.type === "target";
    const ioType: GhostNodeData["ioType"] = isInputConnection
      ? "input"
      : "output";

    const handleId = connectionFromHandle.id ?? "";
    const portName = extractPortName(handleId, ioType);

    const taskEntityId = connectionFromHandle.nodeId;
    const task = spec.tasks.find((t) => t.$id === taskEntityId);
    const taskComponentSpec = task?.componentRef.spec as
      | ComponentSpecJson
      | undefined;

    const dataType = lookupPortType(taskComponentSpec, portName, ioType);

    ghostNode = {
      id: GHOST_NODE_ID,
      type: "ghost" as const,
      position: connectionPosition,
      data: {
        ioType,
        label: portName,
        dataType,
      },
      draggable: false,
      selectable: false,
      deletable: false,
      connectable: false,
      focusable: false,
      zIndex: 1000,
    };
  }

  let ghostEdge: Edge | null = null;

  if (ghostNode && connectionFromHandle) {
    const isFromSource = connectionFromHandle.type === "source";

    ghostEdge = {
      id: "ghost-edge",
      source: isFromSource ? connectionFromHandle.nodeId : GHOST_NODE_ID,
      sourceHandle: isFromSource ? connectionFromHandle.id : GHOST_HANDLE_ID,
      target: isFromSource ? GHOST_NODE_ID : connectionFromHandle.nodeId,
      targetHandle: isFromSource ? GHOST_HANDLE_ID : connectionFromHandle.id,
      style: {
        stroke: isFromSource ? "#4ade80" : "#60a5fa",
        strokeWidth: 4,
        strokeDasharray: "5,5",
        strokeOpacity: 0.5,
      },
      animated: true,
    };
  }

  return {
    ghostNode,
    ghostEdge,
  };
}
