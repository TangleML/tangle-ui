import type { ReactFlowInstance, ReactFlowProps } from "@xyflow/react";
import type { DragEvent } from "react";

import type { ComponentReference, ComponentSpec } from "@/models/componentSpec";
import { hydrateComponentReference } from "@/services/componentService";
import type { TaskSpec } from "@/utils/componentSpec";

import { addInput, addOutput, addTask } from "../../../store/actions";

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

      // todo: introduce better handling of node types, remove if statements, make it SOLID
      if (parsedData.task) {
        const taskSpec = parsedData.task as TaskSpec;
        const componentRef = await hydrateComponentReference(
          taskSpec.componentRef,
        );
        if (componentRef) {
          addTask(spec, componentRef as ComponentReference, position);
        }
      } else if (parsedData.input !== undefined) {
        addInput(spec, position);
      } else if (parsedData.output !== undefined) {
        addOutput(spec, position);
      }
    } catch (err) {
      console.error("Failed to parse dropped data:", err);
    }
  };

  return { onDragOver, onDrop };
}
