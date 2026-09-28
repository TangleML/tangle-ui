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
import {
  findFlexNode,
  getFlexNodes,
} from "@/models/componentSpec/queries/flexNodes";
import type { UndoGroupable } from "@/routes/v2/shared/nodes/types";
import { FLEX_NODES_ANNOTATION } from "@/utils/annotations";

const idGen = new IncrementingIdGenerator();

export function setFlexNodes(
  undo: UndoGroupable,
  spec: ComponentSpec,
  nodes: FlexNodeData[],
) {
  undo.withGroup("Update flex nodes", () => {
    spec.annotations.set(FLEX_NODES_ANNOTATION, nodes);
  });
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
  overrides: {
    properties?: Partial<FlexNodeData["properties"]>;
    size?: FlexNodeData["size"];
    createdBy?: string;
  } = {},
): FlexNodeData {
  const nodes = getFlexNodes(spec);
  const newNode: FlexNodeData = {
    id: idGen.next("flex"),
    properties: { ...DEFAULT_STICKY_NOTE, ...overrides.properties },
    metadata: {
      createdAt: new Date().toISOString(),
      createdBy: overrides.createdBy ?? "user",
    },
    size: { ...DEFAULT_FLEX_NODE_SIZE, ...overrides.size },
    position,
    zIndex: 0,
  };
  undo.withGroup("Add flex node", () => {
    setFlexNodes(undo, spec, [...nodes, newNode]);
  });
  return newNode;
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
    if (!flexNode || flexNode.locked) return;
    updateFlexNode(undo, spec, nodeId, { position });
  });
}
