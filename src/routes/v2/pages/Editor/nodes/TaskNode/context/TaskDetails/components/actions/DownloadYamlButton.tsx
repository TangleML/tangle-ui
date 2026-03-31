import { ActionButton } from "@/components/shared/Buttons/ActionButton";
import { useTask } from "@/routes/v2/pages/Editor/nodes/TaskNode/context/TaskDetails/hooks/useTask";
import { downloadYamlFromComponentText } from "@/utils/URL";

import { getTaskYamlText } from "./getTaskYamlText";

interface DownloadYamlButtonProps {
  entityId: string;
}

export function DownloadYamlButton({ entityId }: DownloadYamlButtonProps) {
  const task = useTask(entityId);
  if (!task) return null;

  const yamlText = getTaskYamlText(task);
  const handleClick = () => downloadYamlFromComponentText(yamlText, task.name);

  return (
    <ActionButton
      tooltip="Download YAML"
      icon="Download"
      onClick={handleClick}
    />
  );
}
