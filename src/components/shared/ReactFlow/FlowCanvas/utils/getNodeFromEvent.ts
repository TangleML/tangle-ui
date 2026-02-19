import type { DragEvent } from "react";

import type { TaskSpec } from "@/utils/componentSpec";

import type { NodeType } from "../types";

export const getNodeFromEvent = (event: DragEvent) => {
  const droppedData = event.dataTransfer.getData("application/reactflow");

  if (droppedData === "") {
    return { spec: null, nodeType: null };
  }

  const droppedDataObject = JSON.parse(droppedData);
  const nodeType = Object.keys(droppedDataObject)[0] as NodeType;
  const spec = droppedDataObject[nodeType] as TaskSpec | null;

  return { spec, nodeType };
};
