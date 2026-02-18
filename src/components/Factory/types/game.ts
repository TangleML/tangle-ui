import type { Edge, Node } from "@xyflow/react";

export interface GameState {
  day: number;
  nodes: Node[];
  edges: Edge[];
}

export interface BuildingState {
  nodeId: string;
  productionProgress: number;
  stockpile: Record<string, number>;
}
