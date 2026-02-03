import { ensureAnnotations, FLEX_NODES_ANNOTATION } from "@/utils/annotations";
import type { ComponentSpec } from "@/utils/componentSpec";
import { deepClone } from "@/utils/deepClone";

import { type FlexNodeData, isFlexNodeData } from "./types";

export function serializeFlexNodes(data: FlexNodeData[]): string {
  return JSON.stringify(data);
}

export function deserializeFlexNodes(
  serializedData: string | undefined,
): FlexNodeData[] {
  if (!serializedData) {
    return [];
  }

  try {
    const parsed = JSON.parse(serializedData);

    if (!Array.isArray(parsed) || !parsed.every(isFlexNodeData)) {
      throw new Error("Invalid FlexNode data format");
    }

    return parsed;
  } catch (error) {
    console.error("Failed to deserialize FlexNodes:", error);
    return [];
  }
}

export const getFlexNode = (id: string, componentSpec: ComponentSpec) => {
  const flexNodes = getFlexNodeAnnotations(componentSpec);
  return flexNodes.find((node) => node.id === id);
};

export const getFlexNodeAnnotations = (
  componentSpec: ComponentSpec,
): FlexNodeData[] => {
  if (!componentSpec.metadata?.annotations) {
    return [];
  }

  const flexNodesAnnotations = deserializeFlexNodes(
    componentSpec.metadata.annotations[FLEX_NODES_ANNOTATION],
  );

  return flexNodesAnnotations;
};

export const updateFlexNodeInComponentSpec = (
  componentSpec: ComponentSpec,
  flexNode: FlexNodeData,
): ComponentSpec => {
  const clonedComponentSpec = deepClone(componentSpec);
  const newComponentSpec = ensureAnnotations(clonedComponentSpec);

  const flexNodesAnnotations = getFlexNodeAnnotations(newComponentSpec);

  const existingNodeIndex = flexNodesAnnotations.findIndex(
    (node) => node.id === flexNode.id,
  );

  if (existingNodeIndex === -1) {
    // Add a new Flex Node
    flexNodesAnnotations.push(flexNode);
  } else {
    // Update an existing Flex Node
    flexNodesAnnotations[existingNodeIndex] = flexNode;
  }

  newComponentSpec.metadata.annotations = {
    ...newComponentSpec.metadata.annotations,
    [FLEX_NODES_ANNOTATION]: serializeFlexNodes(flexNodesAnnotations),
  };

  return newComponentSpec;
};

export const removeFlexNodeFromComponentSpec = (
  componentSpec: ComponentSpec,
  flexNodeId: string,
): ComponentSpec => {
  const clonedComponentSpec = deepClone(componentSpec);
  const newComponentSpec = ensureAnnotations(clonedComponentSpec);

  const flexNodesAnnotations = getFlexNodeAnnotations(newComponentSpec);

  const updatedFlexNodes = flexNodesAnnotations.filter(
    (node) => node.id !== flexNodeId,
  );

  newComponentSpec.metadata.annotations = {
    ...newComponentSpec.metadata.annotations,
    [FLEX_NODES_ANNOTATION]: serializeFlexNodes(updatedFlexNodes),
  };

  return newComponentSpec;
};
