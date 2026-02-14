import type { Node, ReactFlowInstance } from "@xyflow/react";
import type { DragEvent } from "react";

import { createBuildingNode } from "../../objects/buildings/createBuildingNode";

export const createOnDrop = (
  reactFlowInstance: ReactFlowInstance | undefined,
  setNodes: (update: Node[] | ((nodes: Node[]) => Node[])) => void,
) => {
  return (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();

    if (!reactFlowInstance) return;

    const droppedBuildingData = event.dataTransfer.getData(
      "application/reactflow",
    );

    try {
      const { buildingType } = JSON.parse(droppedBuildingData);

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const offsetData = event.dataTransfer.getData("DragStart.offset");
      if (offsetData) {
        const { offsetX, offsetY } = JSON.parse(offsetData);
        position.x -= offsetX;
        position.y -= offsetY;
      }

      const newNode = createBuildingNode(buildingType, position);

      setNodes((nds) => [...nds, newNode]);
    } catch (error) {
      console.error("Failed to drop building:", error);
    }
  };
};
