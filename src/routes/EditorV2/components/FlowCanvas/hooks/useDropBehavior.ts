import "../../../nodes"; // ensure manifests are registered

import type { ReactFlowInstance, ReactFlowProps } from "@xyflow/react";
import type { DragEvent } from "react";

import type { ComponentSpec } from "@/models/componentSpec";

import { NODE_TYPE_REGISTRY } from "../../../nodes/registry";

export function useDropBehavior(
  spec: ComponentSpec | null,
  reactFlowInstance: ReactFlowInstance | null,
): Required<Pick<ReactFlowProps, "onDragOver" | "onDrop">> {
  const onDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  };

  const onDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!spec || !reactFlowInstance) return;

    const droppedData = event.dataTransfer.getData("application/reactflow");
    if (!droppedData) return;

    const position = reactFlowInstance.screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    });

    try {
      const parsedData = JSON.parse(droppedData);

      for (const manifest of NODE_TYPE_REGISTRY.all()) {
        if (manifest.drop && parsedData[manifest.drop.dataKey] !== undefined) {
          await manifest.drop.handler(
            spec,
            parsedData[manifest.drop.dataKey],
            position,
          );
          break;
        }
      }
    } catch (err) {
      console.error("Failed to parse dropped data:", err);
    }
  };

  return { onDragOver, onDrop };
}
