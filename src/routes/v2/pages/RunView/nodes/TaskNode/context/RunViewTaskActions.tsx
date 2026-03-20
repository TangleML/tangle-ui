import { withSuspenseWrapper } from "@/components/shared/SuspenseWrapper";
import TaskActions from "@/components/shared/TaskDetails/Actions";
import { useHydrateComponentReference } from "@/hooks/useHydrateComponentReference";
import type { ComponentReference } from "@/utils/componentSpec";

interface RunViewTaskActionsProps {
  componentRef: ComponentReference;
}

const RunViewTaskActionsInternal = ({
  componentRef,
}: RunViewTaskActionsProps) => {
  const hydratedRef = useHydrateComponentReference(componentRef);

  if (!hydratedRef) return null;

  return <TaskActions componentRef={hydratedRef} readOnly />;
};

export const RunViewTaskActions =
  withSuspenseWrapper(RunViewTaskActionsInternal);
