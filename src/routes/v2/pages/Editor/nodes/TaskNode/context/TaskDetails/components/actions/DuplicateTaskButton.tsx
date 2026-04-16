import { useMutation } from "@tanstack/react-query";

import { ActionButton } from "@/components/shared/Buttons/ActionButton";
import useToastNotification from "@/hooks/useToastNotification";
import { useTask } from "@/routes/v2/pages/Editor/nodes/TaskNode/context/TaskDetails/hooks/useTask";
import { useTaskActions } from "@/routes/v2/pages/Editor/store/actions/useTaskActions";
import { useSpec } from "@/routes/v2/shared/providers/SpecContext";
import { getErrorMessage } from "@/utils/string";

interface DuplicateTaskButtonProps {
  entityId: string;
}

export function DuplicateTaskButton({ entityId }: DuplicateTaskButtonProps) {
  const task = useTask(entityId);
  const spec = useSpec();
  const { duplicateSelectedNodes } = useTaskActions();
  const notify = useToastNotification();

  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      if (!spec || !task) throw new Error("No spec or task available");
      const position = task.annotations.get("editor.position") ?? {
        x: 0,
        y: 0,
      };
      duplicateSelectedNodes(spec, [{ id: entityId, type: "task", position }]);
    },
    onSuccess: () => notify("Task duplicated", "success"),
    onError: (error) =>
      notify("Failed to duplicate task: " + getErrorMessage(error), "error"),
  });

  if (!spec || !task) return null;

  return (
    <ActionButton
      tooltip="Duplicate Task"
      icon="Copy"
      onClick={() => mutate()}
      disabled={isPending}
    />
  );
}
