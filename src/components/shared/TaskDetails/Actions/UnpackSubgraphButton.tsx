import { useState } from "react";

import { useComponentSpec } from "@/providers/ComponentSpecProvider";
import { unpackSubgraph } from "@/utils/nodes/unpacking/unpackSubgraph";
import {
  getSubgraphDescription,
  updateSubgraphSpec,
} from "@/utils/subgraphUtils";

import { ActionButton } from "../../Buttons/ActionButton";
import { removeTask } from "../../ReactFlow/FlowCanvas/utils/removeNode";

interface UnpackSubgraphButtonProps {
  taskId: string;
}

export const UnpackSubgraphButton = ({ taskId }: UnpackSubgraphButtonProps) => {
  const {
    currentGraphSpec,
    currentSubgraphSpec,
    currentSubgraphPath,
    componentSpec,
    setComponentSpec,
  } = useComponentSpec();

  const [isLoading, setIsLoading] = useState(false);

  const taskSpec = currentGraphSpec.tasks[taskId];
  const subgraphDescription = taskSpec ? getSubgraphDescription(taskSpec) : "";

  function handleUnpackSubgraph() {
    setIsLoading(true);
    const updatedSubgraphSpec = unpackSubgraph(taskId, currentSubgraphSpec);

    const cleanedSubgraphSpec = removeTask(taskId, updatedSubgraphSpec);

    const newRootSpec = updateSubgraphSpec(
      componentSpec,
      currentSubgraphPath,
      cleanedSubgraphSpec,
    );

    setComponentSpec(newRootSpec);
    setIsLoading(false);
  }

  return (
    <ActionButton
      tooltip={`Unpack Subgraph: ${subgraphDescription}`}
      icon="PackageOpen"
      onClick={handleUnpackSubgraph}
      disabled={isLoading}
    />
  );
};
