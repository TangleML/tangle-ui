import type { Node, ReactFlowInstance } from "@xyflow/react";
import type { DragEvent } from "react";

import type { Building } from "../../types/buildings";

let nodeIdCounter = 0;

export const createOnDrop = (
  reactFlowInstance: ReactFlowInstance | undefined,
  setNodes: (update: Node[] | ((nodes: Node[]) => Node[])) => void,
) => {
  return (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();

    if (!reactFlowInstance) return;

    const buildingData = event.dataTransfer.getData("application/reactflow");
    if (!buildingData) return;

    try {
      const { building } = JSON.parse(buildingData) as { building: Building };

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

      const newNode: Node = {
        id: `${building.id}-${nodeIdCounter++}`,
        type: "building",
        position,
        data: {
          ...building,
          label: building.name,
        },
        draggable: true,
        deletable: true,
        selectable: true,
      };

      setNodes((nds) => [...nds, newNode]);
    } catch (error) {
      console.error("Failed to drop building:", error);
    }
  };
};
