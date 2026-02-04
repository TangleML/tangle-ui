import { type Node } from "@xyflow/react";

import { isDefinedNode, type NodeType } from "../types";

type ZIndexDefinition = {
  min: number;
  max: number;
  default: number;
};

export const Z_INDEX_RANGES: Record<NodeType, ZIndexDefinition> = {
  task: {
    min: -100,
    max: 100,
    default: 0,
  },
  input: {
    min: -100,
    max: 100,
    default: 0,
  },
  output: {
    min: -100,
    max: 100,
    default: 0,
  },
  ghost: {
    min: 100,
    max: 100,
    default: 100,
  },
  flex: {
    min: -100,
    max: 100,
    default: 0,
  },
};

const getNodeZIndexProp = (
  node: Node,
  prop: keyof ZIndexDefinition,
): number => {
  if (!isDefinedNode(node)) {
    return 0;
  }

  return Z_INDEX_RANGES[node.type][prop];
};

const getAllNodeZIndices = (nodes: Node[]): number[] => {
  return nodes
    .map((node) => node.zIndex ?? getNodeZIndexProp(node, "default"))
    .sort((a, b) => a - b);
};

export const bringToFront = (node: Node, allNodes: Node[]): number => {
  const allZIndices = getAllNodeZIndices(allNodes);
  const maxZ = Math.max(...allZIndices, getNodeZIndexProp(node, "default"));
  const nodeMax = getNodeZIndexProp(node, "max");
  return Math.min(maxZ + 1, nodeMax);
};

export const sendToBack = (node: Node, allNodes: Node[]): number => {
  const allZIndices = getAllNodeZIndices(allNodes);
  const minZ = Math.min(...allZIndices, getNodeZIndexProp(node, "default"));
  const nodeMin = getNodeZIndexProp(node, "min");
  return Math.max(minZ - 1, nodeMin);
};

export const moveForward = (node: Node, allNodes: Node[]): number => {
  const currentZ = node.zIndex ?? getNodeZIndexProp(node, "default");
  const allZIndices = getAllNodeZIndices(allNodes);
  const nodeMax = getNodeZIndexProp(node, "max");

  const higherIndices = allZIndices.filter((z) => z > currentZ);
  if (higherIndices.length === 0) {
    return currentZ;
  }

  const nextZ = Math.min(...higherIndices);
  return Math.min(nextZ === currentZ + 1 ? nextZ + 1 : nextZ, nodeMax);
};

export const moveBackward = (node: Node, allNodes: Node[]): number => {
  const currentZ = node.zIndex ?? getNodeZIndexProp(node, "default");
  const allZIndices = getAllNodeZIndices(allNodes);
  const nodeMin = getNodeZIndexProp(node, "min");

  const lowerIndices = allZIndices.filter((z) => z < currentZ);
  if (lowerIndices.length === 0) {
    return currentZ;
  }

  const prevZ = Math.max(...lowerIndices);
  return Math.max(prevZ === currentZ - 1 ? prevZ - 1 : prevZ, nodeMin);
};
