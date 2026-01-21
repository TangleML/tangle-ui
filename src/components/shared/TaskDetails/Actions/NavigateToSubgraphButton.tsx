import { useComponentSpec } from "@/providers/ComponentSpecProvider";
import { getSubgraphDescription } from "@/utils/subgraphUtils";

import { ActionButton } from "../../Buttons/ActionButton";

interface NavigateToSubgraphButtonProps {
  taskId: string;
}

export const NavigateToSubgraphButton = ({
  taskId,
}: NavigateToSubgraphButtonProps) => {
  const { navigateToSubgraph, currentGraphSpec } = useComponentSpec();

  const taskSpec = currentGraphSpec.tasks[taskId];

  const subgraphDescription = taskSpec ? getSubgraphDescription(taskSpec) : "";

  const handleClick = () => {
    navigateToSubgraph(taskId);
  };

  return (
    <ActionButton
      tooltip={`Enter Subgraph: ${subgraphDescription}`}
      icon="Workflow"
      onClick={handleClick}
    />
  );
};
