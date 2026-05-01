import { useMutation } from "@tanstack/react-query";

import { ActionButton } from "@/components/shared/Buttons/ActionButton";
import useToastNotification from "@/hooks/useToastNotification";
import { useTask } from "@/routes/v2/pages/Editor/nodes/TaskNode/context/TaskDetails/hooks/useTask";
import { useTaskActions } from "@/routes/v2/pages/Editor/store/actions/useTaskActions";
import { useSpec } from "@/routes/v2/shared/providers/SpecContext";
import { isGraphImplementation } from "@/utils/componentSpec";
import { getErrorMessage } from "@/utils/string";

interface UnpackSubgraphButtonProps {
  entityId: string;
}

export function UnpackSubgraphButton({ entityId }: UnpackSubgraphButtonProps) {
  const task = useTask(entityId);
  const spec = useSpec();
  const { unpackSubgraphTask } = useTaskActions();
  const notify = useToastNotification();

  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      if (!spec) throw new Error("No spec available");
      unpackSubgraphTask(spec, entityId);
    },
    onSuccess: () => notify("Subgraph unpacked", "success"),
    onError: (error) =>
      notify("Failed to unpack subgraph: " + getErrorMessage(error), "error"),
  });

  if (!task) return null;
  if (!isGraphImplementation(task.componentRef.spec?.implementation))
    return null;

  return (
    <ActionButton
      tooltip="Unpack Subgraph"
      icon="PackageOpen"
      onClick={() => mutate()}
      disabled={isPending}
    />
  );
}
