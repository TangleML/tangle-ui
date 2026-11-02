import { withSuspenseWrapper } from "@/components/shared/SuspenseWrapper";
import TaskActions from "@/components/shared/TaskDetails/Actions";
import { ComponentReferenceBar } from "@/components/shared/TaskDetails/ComponentReferenceBar";
import { useHydrateComponentReference } from "@/hooks/useHydrateComponentReference";
import type { TaskNodeContextType } from "@/providers/TaskNodeProvider";
import type { ComponentReference } from "@/utils/componentSpec";

interface RunViewTaskComponentProps {
  componentRef: ComponentReference;
  taskName: string;
}

const RunViewTaskComponentInternal = ({
  componentRef,
  taskName,
}: RunViewTaskComponentProps) => {
  const hydratedRef = useHydrateComponentReference(componentRef);

  if (!hydratedRef) return null;

  // ad-hoc solution to display "Link" action
  const taskNode = {
    nodeId: taskName,
  } as TaskNodeContextType;

  return (
    <>
      <ComponentReferenceBar
        componentRef={hydratedRef}
        readOnly
        trackingId="v2.run_view.context_panel.component_details_open"
      />
      <TaskActions componentRef={hydratedRef} readOnly taskNode={taskNode} />
    </>
  );
};

export const RunViewTaskComponent = withSuspenseWrapper(
  RunViewTaskComponentInternal,
);
