import { useCallback } from "react";

import { updateFlexNodeInComponentSpec } from "@/components/shared/ReactFlow/FlowCanvas/FlexNode/interface";
import type { FlexNodeData } from "@/components/shared/ReactFlow/FlowCanvas/FlexNode/types";
import { useComponentSpec } from "@/providers/ComponentSpecProvider";
import { updateSubgraphSpec } from "@/utils/subgraphUtils";

export const useFlexNodeUpdate = (flexNode: FlexNodeData) => {
  const {
    componentSpec,
    currentSubgraphSpec,
    currentSubgraphPath,
    setComponentSpec,
  } = useComponentSpec();

  const updateFlexNode = useCallback(
    (updates: Partial<FlexNodeData>) => {
      const updatedFlexNode = {
        ...flexNode,
        ...updates,
      };

      const updatedSubgraphSpec = updateFlexNodeInComponentSpec(
        currentSubgraphSpec,
        updatedFlexNode,
      );

      const newRootSpec = updateSubgraphSpec(
        componentSpec,
        currentSubgraphPath,
        updatedSubgraphSpec,
      );

      setComponentSpec(newRootSpec);
    },
    [
      flexNode,
      componentSpec,
      currentSubgraphSpec,
      currentSubgraphPath,
      setComponentSpec,
    ],
  );

  const updateProperties = useCallback(
    (propertyUpdates: Partial<FlexNodeData["properties"]>) => {
      updateFlexNode({
        properties: {
          ...flexNode.properties,
          ...propertyUpdates,
        },
      });
    },
    [flexNode.properties, updateFlexNode],
  );

  return { updateFlexNode, updateProperties };
};
