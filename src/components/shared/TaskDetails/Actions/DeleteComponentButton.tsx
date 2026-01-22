import useToastNotification from "@/hooks/useToastNotification";

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
    />
  );
};
