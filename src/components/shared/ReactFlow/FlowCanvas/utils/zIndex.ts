import { type Node } from "@xyflow/react";

import { isDefinedNode, type NodeType } from "../types";

type zIndexDefinition = {
  min: number;
  max: number;
  default: number;
};

export const Z_INDEX_RANGES: Record<NodeType, zIndexDefinition> = {
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
};

const getNodeZIndexDefault = (node: Node): number => {
  if (!isDefinedNode(node)) {
    return 0;
  }

  return Z_INDEX_RANGES[node.type].default;
};

const getNodeZIndexMin = (node: Node): number => {
  if (!isDefinedNode(node)) {
    return 0;
  }

  return Z_INDEX_RANGES[node.type].min;
};

const getNodeZIndexMax = (node: Node): number => {
  if (!isDefinedNode(node)) {
    return 0;
  }

  return Z_INDEX_RANGES[node.type].max;
};

export const getAllNodeZIndices = (nodes: Node[]): number[] => {
  return nodes
    .map((node) => node.zIndex ?? getNodeZIndexDefault(node))
    .sort((a, b) => a - b);
};

export const bringToFront = (node: Node, allNodes: Node[]): number => {
  const allZIndices = getAllNodeZIndices(allNodes);
  const maxZ = Math.max(...allZIndices, getNodeZIndexDefault(node));
  const nodeMax = getNodeZIndexMax(node);
  return Math.min(maxZ + 1, nodeMax);
};

export const sendToBack = (node: Node, allNodes: Node[]): number => {
  const allZIndices = getAllNodeZIndices(allNodes);
  const minZ = Math.min(...allZIndices, getNodeZIndexDefault(node));
  const nodeMin = getNodeZIndexMin(node);
  return Math.max(minZ - 1, nodeMin);
};

export const moveForward = (node: Node, allNodes: Node[]): number => {
  const currentZ = node.zIndex ?? getNodeZIndexDefault(node);
  const allZIndices = getAllNodeZIndices(allNodes);
  const nodeMax = getNodeZIndexMax(node);

  const higherIndices = allZIndices.filter((z) => z > currentZ);
  if (higherIndices.length === 0) {
    return Math.min(currentZ + 1, nodeMax);
  }

  const nextZ = Math.min(...higherIndices);
  return Math.min(nextZ === currentZ + 1 ? nextZ + 1 : nextZ, nodeMax);
};

export const moveBackward = (node: Node, allNodes: Node[]): number => {
  const currentZ = node.zIndex ?? getNodeZIndexDefault(node);
  const allZIndices = getAllNodeZIndices(allNodes);
  const nodeMin = getNodeZIndexMin(node);

  const lowerIndices = allZIndices.filter((z) => z < currentZ);
  if (lowerIndices.length === 0) {
    return Math.max(currentZ - 1, nodeMin);
  }

  const prevZ = Math.max(...lowerIndices);
  return Math.max(prevZ === currentZ - 1 ? prevZ - 1 : prevZ, nodeMin);
};
