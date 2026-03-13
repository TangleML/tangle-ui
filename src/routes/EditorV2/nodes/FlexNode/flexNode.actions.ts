import type { XYPosition } from "@xyflow/react";

import type { FlexNodeData } from "@/components/shared/ReactFlow/FlowCanvas/FlexNode/types";
import {
  DEFAULT_FLEX_NODE_SIZE,
  DEFAULT_STICKY_NOTE,
} from "@/components/shared/ReactFlow/FlowCanvas/FlexNode/utils";
import {
  type ComponentSpec,
  IncrementingIdGenerator,
} from "@/models/componentSpec";

import { withUndoGroup } from "../../store/undoStore";

const FLEX_NODES_KEY = "flex-nodes" as const;

const idGen = new IncrementingIdGenerator();

export function getFlexNodes(spec: ComponentSpec): FlexNodeData[] {
  return spec.annotations.get(FLEX_NODES_KEY);
}

export function setFlexNodes(spec: ComponentSpec, nodes: FlexNodeData[]) {
  withUndoGroup("Update flex nodes", () => {
    spec.annotations.set(FLEX_NODES_KEY, nodes);
  });
}

export function findFlexNode(
  spec: ComponentSpec,
  id: string,
): FlexNodeData | undefined {
  return getFlexNodes(spec).find((n) => n.id === id);
}

export function updateFlexNode(
  spec: ComponentSpec,
  nodeId: string,
  updates: Partial<FlexNodeData>,
) {
  withUndoGroup("Update flex node", () => {
    const nodes = getFlexNodes(spec);
    const updated = nodes.map((n) =>
      n.id === nodeId ? { ...n, ...updates } : n,
    );
    setFlexNodes(spec, updated);
  });
}

export function updateFlexNodeProperties(
  spec: ComponentSpec,
  nodeId: string,
  properties: Partial<FlexNodeData["properties"]>,
) {
  const node = findFlexNode(spec, nodeId);
  if (!node) return;

  updateFlexNode(spec, nodeId, {
    properties: { ...node.properties, ...properties },
  });
}

export function addFlexNode(spec: ComponentSpec, position: XYPosition) {
  const nodes = getFlexNodes(spec);
  const id = idGen.next("flex");
  const newNode: FlexNodeData = {
    id,
    properties: { ...DEFAULT_STICKY_NOTE },
    metadata: {
      createdAt: new Date().toISOString(),
      createdBy: "user",
    },
    size: { ...DEFAULT_FLEX_NODE_SIZE },
    position,
    zIndex: 0,
  };
  withUndoGroup("Add flex node", () => {
    setFlexNodes(spec, [...nodes, newNode]);
  });
}

export function removeFlexNode(spec: ComponentSpec, nodeId: string) {
  withUndoGroup("Remove flex node", () => {
    const nodes = getFlexNodes(spec);
    setFlexNodes(
      spec,
      nodes.filter((n) => n.id !== nodeId),
    );
  });
}

export function updateFlexNodePosition(
  spec: ComponentSpec,
  nodeId: string,
  position: XYPosition,
) {
  withUndoGroup("Update flex node position", () => {
    const nodes = getFlexNodes(spec);
    const updated = nodes.map((n) =>
      n.id === nodeId ? { ...n, position } : n,
    );
    setFlexNodes(spec, updated);
  });
}
