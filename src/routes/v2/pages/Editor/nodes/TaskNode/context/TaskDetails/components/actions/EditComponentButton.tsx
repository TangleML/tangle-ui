import { useState } from "react";

import { ActionButton } from "@/components/shared/Buttons/ActionButton";
import { ComponentEditorDialog } from "@/components/shared/ComponentEditor/ComponentEditorDialog";
import { useTask } from "@/routes/v2/pages/Editor/nodes/TaskNode/context/TaskDetails/hooks/useTask";

import { getTaskYamlText } from "./getTaskYamlText";

interface EditComponentButtonProps {
  entityId: string;
}

export function EditComponentButton({ entityId }: EditComponentButtonProps) {
  const task = useTask(entityId);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  if (!task) return null;

  const yamlText = getTaskYamlText(task);

  return (
    <>
      <ActionButton
        tooltip="Edit Component Definition"
        icon="FilePenLine"
        onClick={() => setIsEditDialogOpen(true)}
      />
      {isEditDialogOpen && (
        <ComponentEditorDialog
          text={yamlText}
          onClose={() => setIsEditDialogOpen(false)}
        />
      )}
    </>
  );
}
