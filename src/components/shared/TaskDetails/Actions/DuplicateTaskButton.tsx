import { ActionButton } from "../../Buttons/ActionButton";

interface DuplicateTaskButtonProps {
  onDuplicate: () => void;
}

export const DuplicateTaskButton = ({
  onDuplicate,
}: DuplicateTaskButtonProps) => {
  return (
    <ActionButton label="Duplicate Task" icon="Copy" onClick={onDuplicate} />
  );
};
