import type { Node, XYPosition } from "@xyflow/react";

export type Bounds = { x: number; y: number; width: number; height: number };

export const isPositionInNode = (node: Node, position: XYPosition) => {
  const nodeRect = {
    x: node.position.x,
    y: node.position.y,
    width: node.measured?.width || 0,
    height: node.measured?.height || 0,
  };

  return (
    position.x >= nodeRect.x &&
    position.x <= nodeRect.x + nodeRect.width &&
    position.y >= nodeRect.y &&
    position.y <= nodeRect.y + nodeRect.height
  );
};

export const calculateNodesCenter = (nodes: Node[]): XYPosition => {
  if (nodes.length === 0) return { x: 0, y: 0 };

  const sumX = nodes.reduce((sum, node) => sum + node.position.x, 0);
  const sumY = nodes.reduce((sum, node) => sum + node.position.y, 0);

  return {
    x: sumX / nodes.length,
    y: sumY / nodes.length,
  };
};

/*
 * 'getNodesBounds' from useReactFlow currently appears to be bugged and is producing the incorrect coordinates based on the old node position.
 * As a workaround this method calculates the node bounds origin and size manually.
 */
export const getNodesBounds = (nodes: Node[]): Bounds => {
  const bounds = nodes.reduce(
    (acc, node) => {
      if (!node.measured) {
        console.warn("Node is missing measurement data:", node.id);
        return acc;
      }

      const width = node.measured?.width || 0;
      const height = node.measured?.height || 0;

      return {
        x: Math.min(acc.x, node.position.x),
        y: Math.min(acc.y, node.position.y),
        width: Math.max(acc.width, node.position.x + width),
        height: Math.max(acc.height, node.position.y + height),
      };
    },
    { x: Infinity, y: Infinity, width: -Infinity, height: -Infinity },
  );

  return {
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
  };
};

export const normalizeNodePosition = (
  node: Node,
  bounds: Bounds,
): XYPosition => {
  const offsetX = -bounds.x;
  const offsetY = -bounds.y;

  return { x: node.position.x + offsetX, y: node.position.y + offsetY };
};
