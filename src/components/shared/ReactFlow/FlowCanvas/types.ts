import type { Edge, Node } from "@xyflow/react";
import type { ComponentType } from "react";

import type { TaskType } from "@/types/taskNode";

import SmoothEdge from "./Edges/SmoothEdge";
import GhostNode from "./GhostNode/GhostNode";
import IONode from "./IONode/IONode";
import TaskNode from "./TaskNode/TaskNode";

export type NodesAndEdges = {
  nodes: Node[];
  edges: Edge[];
};

export const nodeTypes: Record<string, ComponentType<any>> = {
  task: TaskNode,
  input: IONode,
  output: IONode,
  ghost: GhostNode,
};

export type NodeType = keyof typeof nodeTypes;

export const edgeTypes: Record<string, ComponentType<any>> = {
  customEdge: SmoothEdge,
};

export function isTaskNodeType(type: string): type is TaskType {
  return type === "task" || type === "input" || type === "output";
}
