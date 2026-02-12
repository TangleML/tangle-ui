import type { Connection, Edge } from "@xyflow/react";

import { RESOURCES } from "../../data/resources";
import { extractResource } from "../../utils/string";

export const createOnConnect = (
  setEdges: (update: Edge[] | ((edges: Edge[]) => Edge[])) => void,
) => {
  return (connection: Connection) => {
    if (connection.source === connection.target) return;

    const sourceResource = extractResource(connection.sourceHandle);
    const targetResource = extractResource(connection.targetHandle);

    if (
      sourceResource !== "any" &&
      targetResource !== "any" &&
      sourceResource !== targetResource
    ) {
      return;
    }

    const edgeResource = sourceResource ?? targetResource;

    if (!edgeResource) {
      console.error("Invalid resource type:", edgeResource);
      return;
    }

    const newEdge: Edge = {
      ...connection,
      id: `${connection.source}-${connection.sourceHandle}-${connection.target}-${connection.targetHandle}`,
      type: "resourceEdge",
      data: { ...RESOURCES[edgeResource] },
      animated: true,
    };

    setEdges((eds) => {
      const filteredEdges = eds.filter(
        (edge) =>
          !(
            (edge.source === connection.source &&
              edge.sourceHandle === connection.sourceHandle) ||
            (edge.target === connection.target &&
              edge.targetHandle === connection.targetHandle)
          ),
      );

      return [...filteredEdges, newEdge];
    });
  };
};
