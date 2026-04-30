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
import type { UndoGroupable } from "@/routes/v2/shared/nodes/types";

const FLEX_NODES_KEY = "flex-nodes" as const;

const idGen = new IncrementingIdGenerator();

export function getFlexNodes(spec: ComponentSpec): FlexNodeData[] {
  return spec.annotations.get(FLEX_NODES_KEY);
}

export function setFlexNodes(
  undo: UndoGroupable,
  spec: ComponentSpec,
  nodes: FlexNodeData[],
) {
  undo.withGroup("Update flex nodes", () => {
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
  undo: UndoGroupable,
  spec: ComponentSpec,
  nodeId: string,
  updates: Partial<FlexNodeData>,
) {
  undo.withGroup("Update flex node", () => {
    const nodes = getFlexNodes(spec);
    const updated = nodes.map((n) =>
      n.id === nodeId ? { ...n, ...updates } : n,
    );
    setFlexNodes(undo, spec, updated);
  });
}

export function updateFlexNodeProperties(
  undo: UndoGroupable,
  spec: ComponentSpec,
  nodeId: string,
  properties: Partial<FlexNodeData["properties"]>,
) {
  const node = findFlexNode(spec, nodeId);
  if (!node) return;

  updateFlexNode(undo, spec, nodeId, {
    properties: { ...node.properties, ...properties },
  });
}

export function addFlexNode(
  undo: UndoGroupable,
  spec: ComponentSpec,
  position: XYPosition,
) {
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
  undo.withGroup("Add flex node", () => {
    setFlexNodes(undo, spec, [...nodes, newNode]);
  });
}

export function removeFlexNode(
  undo: UndoGroupable,
  spec: ComponentSpec,
  nodeId: string,
) {
  undo.withGroup("Remove flex node", () => {
    const nodes = getFlexNodes(spec);
    setFlexNodes(
      undo,
      spec,
      nodes.filter((n) => n.id !== nodeId),
    );
  });
}

export function updateFlexNodePosition(
  undo: UndoGroupable,
  spec: ComponentSpec,
  nodeId: string,
  position: XYPosition,
) {
  undo.withGroup("Update flex node position", () => {
    const flexNode = findFlexNode(spec, nodeId);
    if (!flexNode) return;
    updateFlexNode(undo, spec, nodeId, { position });
  });
}
