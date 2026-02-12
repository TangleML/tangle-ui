import type { Connection, Edge } from "@xyflow/react";

import { extractResource } from "../../utils/string";

export const createIsValidConnection = (edges: Edge[]) => {
  return (connection: Connection | Edge) => {
    if (connection.source === connection.target) return false;

    const sourceResource = extractResource(connection.sourceHandle);
    const targetResource = extractResource(connection.targetHandle);

    if (
      sourceResource !== "any" &&
      targetResource !== "any" &&
      sourceResource !== targetResource
    ) {
      return false;
    }

    const hasExistingConnection = edges.some(
      (edge) =>
        (edge.source === connection.source &&
          edge.sourceHandle === connection.sourceHandle) ||
        (edge.target === connection.target &&
          edge.targetHandle === connection.targetHandle),
    );

    return !hasExistingConnection;
  };
};
