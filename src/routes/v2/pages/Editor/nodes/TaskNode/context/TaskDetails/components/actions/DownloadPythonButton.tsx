import { FaPython } from "react-icons/fa";

import { ActionButton } from "@/components/shared/Buttons/ActionButton";
import { useTask } from "@/routes/v2/pages/Editor/nodes/TaskNode/context/TaskDetails/hooks/useTask";
import { downloadStringAsFile } from "@/utils/URL";

interface DownloadPythonButtonProps {
  entityId: string;
}

export function DownloadPythonButton({ entityId }: DownloadPythonButtonProps) {
  const task = useTask(entityId);
  const pythonCode =
    task?.componentRef.spec?.metadata?.annotations?.python_original_code;

  if (!task || typeof pythonCode !== "string") return null;

  const handleClick = () =>
    downloadStringAsFile(pythonCode, `${task.name}.py`, "text/x-python");

  return (
    <ActionButton tooltip="Download Python Code" onClick={handleClick}>
      <FaPython />
    </ActionButton>
  );
}
