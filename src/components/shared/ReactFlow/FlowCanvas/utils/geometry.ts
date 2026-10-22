import type { Node, XYPosition } from "@xyflow/react";

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
