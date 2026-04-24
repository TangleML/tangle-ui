import useToastNotification from "@/hooks/useToastNotification";
import { tracking } from "@/utils/tracking";

import { ActionButton } from "../../Buttons/ActionButton";

interface DeleteComponentButtonProps {
  onDelete: () => void;
}

export const DeleteComponentButton = ({
  onDelete,
}: DeleteComponentButtonProps) => {
  const notify = useToastNotification();

  const handleClick = () => {
    try {
      onDelete();
    } catch (error) {
      console.error("Error deleting component:", error);
      notify(`Error deleting component`, "error");
    }
  };

  return (
    <ActionButton
      tooltip="Delete Component"
      icon="Trash"
      onClick={handleClick}
      destructive
      {...tracking("pipeline_editor.task_node.delete_component")}
    />
  );
};
