import { useComponentSpecStore } from "@/stores/componentSpecStore";
import { useTaskSpec } from "@/stores/selectors";
import { getSubgraphDescription } from "@/utils/subgraphUtils";

import { ActionButton } from "../../Buttons/ActionButton";

interface NavigateToSubgraphButtonProps {
  taskId: string;
}

export const NavigateToSubgraphButton = ({
  taskId,
}: NavigateToSubgraphButtonProps) => {
  const navigateToSubgraph = useComponentSpecStore((s) => s.navigateToSubgraph);
  const taskSpec = useTaskSpec(taskId);

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
