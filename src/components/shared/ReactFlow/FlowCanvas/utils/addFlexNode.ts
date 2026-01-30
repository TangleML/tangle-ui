import type { XYPosition } from "@xyflow/react";
import { nanoid } from "nanoid";

import { type ComponentSpec } from "@/utils/componentSpec";

import { updateFlexNodeInComponentSpec } from "../FlexNode/interface";
import type { FlexNodeData } from "../FlexNode/types";
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
  const nodeId = nanoid();

  const flexNode: FlexNodeData = {
    id: nodeId,
    properties: DEFAULT_STICKY_NOTE,
    size: DEFAULT_FLEX_NODE_SIZE,
    position: position,
  };

  const newComponentSpec = updateFlexNodeInComponentSpec(
    componentSpec,
    flexNode,
  );

  return { spec: newComponentSpec, nodeId };
};

export default addFlexNode;
