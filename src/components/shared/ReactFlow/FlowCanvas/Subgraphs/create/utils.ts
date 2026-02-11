import type { Node } from "@xyflow/react";

interface GroupingValidation {
  canGroup: boolean;
  errorMessage?: string;
}

export const canGroupNodes = (nodes: Node[]): GroupingValidation => {
  if (nodes.length <= 1) {
    return {
      canGroup: false,
      errorMessage: "At least 2 nodes are required to create a subgraph.",
    };
  }

  if (nodes.filter((node) => node.type === "task").length === 0) {
    return {
      canGroup: false,
      errorMessage: "At least 1 task node is required to create a subgraph.",
    };
  }

  return {
    canGroup: true,
  };
};

export const getNodeTypeColor = (nodeType: string | undefined): string => {
  switch (nodeType) {
    case "flex":
      return "bg-yellow-300";
    case "input":
      return "bg-blue-500";
    case "output":
      return "bg-violet-500";
    case "task":
    default:
      return "bg-gray-500";
  }
};
