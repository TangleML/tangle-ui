import type { Node } from "@xyflow/react";

export const canGroupNodes = (
  nodes: Node[],
  isSubgraphNavigationEnabled: boolean = true,
): boolean => {
  return (
    nodes.length > 1 &&
    nodes.filter((node) => node.type === "task").length > 0 &&
    isSubgraphNavigationEnabled
  );
};

export const getNodeTypeColor = (nodeType: string | undefined): string => {
  switch (nodeType) {
    case "input":
      return "bg-blue-500";
    case "output":
      return "bg-violet-500";
    case "task":
    default:
      return "bg-gray-500";
  }
};
