import type { Node, XYPosition } from "@xyflow/react";

import { DEFAULT_IO_NODE_WIDTH } from "@/components/shared/ReactFlow/FlowCanvas/IONode/IONode";

import type { GhostNodeData } from "./types";

const GHOST_NODE_ID = "ghost-node";

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

export const getGhostNodeLabel = (
  handleName: string | null,
  ioType: GhostNodeData["ioType"],
): string => {
  if (!handleName) {
    return ioType === "input" ? "Input" : "Output";
  }
  const suffix = ioType === "input" ? "input" : "output";
  return `${handleName} ${suffix}`;
};

const getGhostNodeDropPosition = (
  position: XYPosition | null,
  ioType: GhostNodeData["ioType"],
): XYPosition | null => {
  if (!position) {
    return null;
  }

  if (ioType === "input") {
    return {
      x: position.x + GHOST_NODE_BASE_OFFSET_X - DEFAULT_IO_NODE_WIDTH / 2,
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
  ghostNodePosition: XYPosition | null,
  latestFlowPosition: XYPosition | null,
  ghostNodeType: GhostNodeData["ioType"] | null,
  fromHandleType: "source" | "target" | null | undefined,
): XYPosition | null => {
  const basePosition = ghostNodePosition ?? latestFlowPosition;
  if (!basePosition) {
    return null;
  }

  const dropIoType =
    ghostNodeType ?? (fromHandleType === "target" ? "input" : "output");

  return dropIoType
    ? (getGhostNodeDropPosition(basePosition, dropIoType) ?? basePosition)
    : basePosition;
};
