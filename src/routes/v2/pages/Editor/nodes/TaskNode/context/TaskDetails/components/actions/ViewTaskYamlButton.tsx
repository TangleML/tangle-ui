import { useState } from "react";

import { ActionButton } from "@/components/shared/Buttons/ActionButton";
import { CodeViewer } from "@/components/shared/CodeViewer";
import { useTask } from "@/routes/v2/pages/Editor/nodes/TaskNode/context/TaskDetails/hooks/useTask";

import { getTaskYamlText } from "./getTaskYamlText";

interface ViewTaskYamlButtonProps {
  entityId: string;
}

export function ViewTaskYamlButton({ entityId }: ViewTaskYamlButtonProps) {
  const task = useTask(entityId);
  const [showCodeViewer, setShowCodeViewer] = useState(false);

  if (!task) return null;

  const yamlText = getTaskYamlText(task);

  return (
    <>
      <ActionButton
        tooltip="View YAML"
        icon="FileCodeCorner"
        onClick={() => setShowCodeViewer(true)}
      />

      {showCodeViewer && (
        <CodeViewer
          code={yamlText}
          language="yaml"
          filename={task.name}
          fullscreen
          onClose={() => setShowCodeViewer(false)}
        />
      )}
    </>
  );
}
