import { withSuspenseWrapper } from "@/components/shared/SuspenseWrapper";
import TaskActions from "@/components/shared/TaskDetails/Actions";
import { useHydrateComponentReference } from "@/hooks/useHydrateComponentReference";
import type { TaskNodeContextType } from "@/providers/TaskNodeProvider";
import type { ComponentReference } from "@/utils/componentSpec";

interface RunViewTaskActionsProps {
  componentRef: ComponentReference;
  taskName: string;
}

const RunViewTaskActionsInternal = ({
  componentRef,
  taskName,
}: RunViewTaskActionsProps) => {
  const hydratedRef = useHydrateComponentReference(componentRef);

  if (!hydratedRef) return null;

  // ad-hoc solution to display "Link" action
  const taskNode = {
    nodeId: taskName,
  } as TaskNodeContextType;

  return (
    <TaskActions componentRef={hydratedRef} readOnly taskNode={taskNode} />
  );
};

export const RunViewTaskActions = withSuspenseWrapper(
  RunViewTaskActionsInternal,
);
