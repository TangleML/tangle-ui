import type { Node } from "@xyflow/react";
import type { icons } from "lucide-react";

import { getTaskDisplayName } from "@/utils/getComponentName";
import {
  nodeIdToInputName,
  nodeIdToOutputName,
  nodeIdToTaskId,
} from "@/utils/nodes/nodeIdUtils";

import { isFlexNodeData } from "../FlexNode/types";
import { getFlexNodeDisplayName } from "../FlexNode/utils";

export function getNodeTypeIcon(
  nodeType: string | undefined,
): keyof typeof icons {
  switch (nodeType) {
    case "task":
      return "Boxes";
    case "input":
      return "SquareArrowRightEnter";
    case "output":
      return "SquareArrowRightExit";
    case "flex":
      return "StickyNote";
    default:
      return "Circle";
  }
}

export function getNodeTypeLabel(nodeType: string | undefined): string {
  switch (nodeType) {
    case "task":
      return "Task";
    case "input":
      return "Input";
    case "output":
      return "Output";
    case "flex":
      return "Note";
    default:
      return nodeType ?? "";
  }
}

export function getNodeDisplayName(node: Node): string {
  if (node.type === "task") return getTaskDisplayName(nodeIdToTaskId(node.id));
  if (node.type === "input") return nodeIdToInputName(node.id);
  if (node.type === "output") return nodeIdToOutputName(node.id);
  if (node.type === "flex")
    return isFlexNodeData(node.data)
      ? getFlexNodeDisplayName(node.data)
      : node.id;
  return node.id;
}
