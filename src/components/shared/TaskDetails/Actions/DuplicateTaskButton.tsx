import { tracking } from "@/utils/tracking";

import { ActionButton } from "../../Buttons/ActionButton";

interface DuplicateTaskButtonProps {
  onDuplicate: () => void;
}

export const DuplicateTaskButton = ({
  onDuplicate,
}: DuplicateTaskButtonProps) => {
  return (
    <ActionButton
      tooltip="Duplicate Task"
      icon="Copy"
      onClick={onDuplicate}
      {...tracking("pipeline_editor.task_node.duplicate_task")}
    />
  );
};
