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

  const updateFlexNode = (updates: Partial<FlexNodeData>) => {
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
  };

  const updateProperties = (
    propertyUpdates: Partial<FlexNodeData["properties"]>,
  ) => {
    updateFlexNode({
      properties: {
        ...flexNode.properties,
        ...propertyUpdates,
      },
    });
  };

  return { updateFlexNode, updateProperties };
};
