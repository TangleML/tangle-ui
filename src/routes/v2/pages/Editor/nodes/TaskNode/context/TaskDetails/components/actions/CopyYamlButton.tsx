import { ActionButton } from "@/components/shared/Buttons/ActionButton";
import useToastNotification from "@/hooks/useToastNotification";
import { useTask } from "@/routes/v2/pages/Editor/nodes/TaskNode/context/TaskDetails/hooks/useTask";

import { getTaskYamlText } from "./getTaskYamlText";

interface CopyYamlButtonProps {
  entityId: string;
}

export function CopyYamlButton({ entityId }: CopyYamlButtonProps) {
  const task = useTask(entityId);
  const notify = useToastNotification();
  if (!task) return null;

  const yamlText = getTaskYamlText(task);
  const handleClick = () => {
    navigator.clipboard.writeText(yamlText).then(
      () => notify("YAML copied to clipboard", "success"),
      (err) => notify("Failed to copy YAML: " + err, "error"),
    );
  };

  return (
    <ActionButton tooltip="Copy YAML" icon="Clipboard" onClick={handleClick} />
  );
}
