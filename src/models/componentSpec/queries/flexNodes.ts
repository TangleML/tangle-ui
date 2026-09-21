import type { FlexNodeData } from "@/components/shared/ReactFlow/FlowCanvas/FlexNode/types";
import { FLEX_NODES_ANNOTATION } from "@/utils/annotationKeys";

import type { ComponentSpec } from "../entities/componentSpec";

export interface FlexNodeLocation {
  node: FlexNodeData;
  spec: ComponentSpec;
  subgraphTaskNames: string[];
}

export function getFlexNodes(spec: ComponentSpec): FlexNodeData[] {
  return spec.annotations.get(FLEX_NODES_ANNOTATION);
}

export function findFlexNode(
  spec: ComponentSpec,
  id: string,
): FlexNodeData | undefined {
  return getFlexNodes(spec).find((n) => n.id === id);
}

/**
 * Finds which spec in the tree owns a flex node, mirroring `locateEntity` for
 * the entity model. Flex nodes are not entities — each spec keeps its own list
 * in the `flex-nodes` annotation — so they need their own descent, but their
 * ids come from the same `IncrementingIdGenerator` and are unique document-wide,
 * so a match at any depth is unambiguous.
 */
export function locateFlexNode(
  spec: ComponentSpec,
  id: string,
): FlexNodeLocation | undefined {
  const node = findFlexNode(spec, id);
  if (node) {
    return { node, spec, subgraphTaskNames: [] };
  }

  for (const task of spec.tasks) {
    if (!task.subgraphSpec) continue;
    const nested = locateFlexNode(task.subgraphSpec, id);
    if (nested) {
      return {
        ...nested,
        subgraphTaskNames: [task.name, ...nested.subgraphTaskNames],
      };
    }
  }

  return undefined;
}
