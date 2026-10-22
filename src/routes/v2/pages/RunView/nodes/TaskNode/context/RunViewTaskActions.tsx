import { withSuspenseWrapper } from "@/components/shared/SuspenseWrapper";
import TaskActions from "@/components/shared/TaskDetails/Actions";
import { useHydrateComponentReference } from "@/hooks/useHydrateComponentReference";
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

  return <TaskActions componentRef={hydratedRef} readOnly nodeId={taskName} />;
};

export const RunViewTaskActions = withSuspenseWrapper(
  RunViewTaskActionsInternal,
);
