import type {
  Edge,
  Handle,
  Node,
  ReactFlowState,
  XYPosition,
} from "@xyflow/react";

import { DEFAULT_IO_NODE_WIDTH } from "@/components/shared/ReactFlow/FlowCanvas/IONode/IONode";

import { EdgeColor } from "../Edges/utils";
import type { GhostNodeData } from "./types";

export const GHOST_NODE_ID = "ghost-node";

export const GHOST_NODE_BASE_OFFSET_X = -12;
export const GHOST_NODE_BASE_OFFSET_Y = -24;

type CreateGhostNodeParams = {
  position: XYPosition;
  ioType: GhostNodeData["ioType"];
  label: string;
  dataType?: string;
  value?: string;
  defaultValue?: string;
  connectedTaskLabel?: string;
  connectedOutputName?: string;
};

export const createGhostNode = ({
  position,
  ioType,
  label,
  dataType,
  value,
  defaultValue,
  connectedTaskLabel,
  connectedOutputName,
}: CreateGhostNodeParams): Node<GhostNodeData> => ({
  id: GHOST_NODE_ID,
  type: "ghost",
  position,
  data: {
    ioType,
    label,
    dataType: dataType ?? "any",
    value,
    defaultValue,
    connectedTaskLabel,
    connectedOutputName,
  },
  draggable: false,
  selectable: false,
  deletable: false,
  connectable: false,
  focusable: false,
  zIndex: 1000,
});

const getGhostNodeDropPosition = (
  position: XYPosition | null,
  ioType: GhostNodeData["ioType"],
  nodeWidth: number,
): XYPosition | null => {
  if (!position) {
    return null;
  }

  if (ioType === "input") {
    return {
      x: position.x + GHOST_NODE_BASE_OFFSET_X - nodeWidth,
      y: position.y + GHOST_NODE_BASE_OFFSET_Y,
    };
  }

  return {
    x: position.x + GHOST_NODE_BASE_OFFSET_X,
    y: position.y + GHOST_NODE_BASE_OFFSET_Y,
  };
};

/**
 * Computes the final drop position for creating an IO node from a ghost node preview.
 * Uses ghost node position if available, falls back to latest flow position.
 * Adjusts position based on IO type to properly align the created node.
 */
export const computeDropPositionFromRefs = (
  ghostNode: Node<GhostNodeData> | null,
  latestFlowPosition: XYPosition | null,
  fromHandleType: "source" | "target" | null | undefined,
  reactFlowState: ReactFlowState,
): XYPosition | null => {
  const basePosition = ghostNode?.position ?? latestFlowPosition;
  if (!basePosition) {
    return null;
  }

  const dropIoType =
    ghostNode?.data.ioType ??
    (fromHandleType === "target" ? "input" : "output");

  let width = DEFAULT_IO_NODE_WIDTH;

  if (ghostNode) {
    // Get actual ghost node dimensions from React Flow state
    const { nodeLookup } = reactFlowState;
    const node = nodeLookup.get(ghostNode.id);

    if (node?.measured.width && node?.measured.height) {
      width = node.measured.width;
    }
  }

  return dropIoType
    ? (getGhostNodeDropPosition(basePosition, dropIoType, width) ??
        basePosition)
    : basePosition;
};

export const getGhostHandleId = (): string => {
  return `${GHOST_NODE_ID}-handle`;
};

export const createGhostEdge = (connectionSourceHandle: Handle): Edge => {
  const isFromSource = connectionSourceHandle.type === "source";
  const ghostHandleId = getGhostHandleId();

  const edgeColor = isFromSource ? EdgeColor.Output : EdgeColor.Input;

  const ghostEdge = {
    id: "ghost-edge",
    source: isFromSource ? connectionSourceHandle.nodeId : GHOST_NODE_ID,
    sourceHandle: isFromSource ? connectionSourceHandle.id : ghostHandleId,
    target: isFromSource ? GHOST_NODE_ID : connectionSourceHandle.nodeId,
    targetHandle: isFromSource ? ghostHandleId : connectionSourceHandle.id,
    markerStart: undefined,
    markerEnd: undefined,
    style: {
      stroke: edgeColor,
      strokeWidth: 4,
      strokeDasharray: "5,5",
      strokeOpacity: 0.5,
    },
    animated: true,
  };

  return ghostEdge;
};
