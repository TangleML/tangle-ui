import type { XYPosition } from "@xyflow/react";
import { nanoid } from "nanoid";

import { FLEX_NODES_ANNOTATION } from "@/utils/annotations";
import { type ComponentSpec } from "@/utils/componentSpec";
import { deepClone } from "@/utils/deepClone";

import type { FlexNodeSpec } from "../FlexNode/types";
import { DEFAULT_FLEX_NODE_SIZE, DEFAULT_STICKY_NOTE } from "../FlexNode/utils";

interface AddFlexNodeResult {
  spec: ComponentSpec;
  nodeId: string;
}

/**
 * Creates a flex node (sticky note) and adds it to the component annotations.
 *
 * Nodes are created with default properties which can be edited later.
 *
 * @param position - Canvas position {x, y} where the node should be visually placed
 * @param componentSpec - The component specification to modify (will be cloned, not mutated)
 * @returns Object containing the updated spec and nodeId
 *
 * @example
 * // Create a flex node
 * const result = addFlexNode({ x: 100, y: 200 }, componentSpec);
 *
 */
const addFlexNode = (
  position: XYPosition,
  componentSpec: ComponentSpec,
): AddFlexNodeResult => {
  const newComponentSpec = deepClone(componentSpec);

  if (!newComponentSpec.metadata?.annotations) {
    newComponentSpec.metadata = {};
  }

  if (!newComponentSpec.metadata.annotations) {
    newComponentSpec.metadata.annotations = {};
  }

  const nodeId = nanoid();

  const flexNodeSpec: FlexNodeSpec = {
    type: "sticky-note",
    properties: DEFAULT_STICKY_NOTE,
    size: JSON.stringify(DEFAULT_FLEX_NODE_SIZE),
    position: JSON.stringify(position),
  };

  newComponentSpec.metadata.annotations = {
    ...newComponentSpec.metadata.annotations,
    [FLEX_NODES_ANNOTATION]: {
      ...(newComponentSpec.metadata.annotations[FLEX_NODES_ANNOTATION] || {}),
      [nodeId]: flexNodeSpec,
    },
  };

  return { spec: newComponentSpec, nodeId };
};

export default addFlexNode;
