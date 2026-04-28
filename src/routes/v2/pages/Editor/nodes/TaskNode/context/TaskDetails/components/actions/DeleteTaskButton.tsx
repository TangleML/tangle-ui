import { useMutation } from "@tanstack/react-query";

import { ActionButton } from "@/components/shared/Buttons/ActionButton";
import useToastNotification from "@/hooks/useToastNotification";
import { useTaskActions } from "@/routes/v2/pages/Editor/store/actions/useTaskActions";
import { useSpec } from "@/routes/v2/shared/providers/SpecContext";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";
import { getErrorMessage } from "@/utils/string";

interface DeleteTaskButtonProps {
  entityId: string;
}

export function DeleteTaskButton({ entityId }: DeleteTaskButtonProps) {
  const spec = useSpec();
  const { deleteTask } = useTaskActions();
  const notify = useToastNotification();
  const { editor } = useSharedStores();

  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      if (!spec) throw new Error("No spec available");
      deleteTask(spec, entityId);

      // deselect removed nodes
      editor.clearSelection();
      editor.clearMultiSelection();
    },
    onError: (error) =>
      notify("Failed to delete task: " + getErrorMessage(error), "error"),
  });

  if (!spec) return null;

  return (
    <ActionButton
      tooltip="Delete Component"
      icon="Trash"
      onClick={() => mutate()}
      disabled={isPending}
      destructive
    />
  );
}
