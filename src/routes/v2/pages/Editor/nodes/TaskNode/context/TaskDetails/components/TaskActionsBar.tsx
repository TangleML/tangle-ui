import { ActionBlock } from "@/components/shared/ContextPanel/Blocks/ActionBlock";
import { DeleteComponentButton } from "@/components/shared/TaskDetails/Actions/DeleteComponentButton";

import { CopyYamlButton } from "./actions/CopyYamlButton";
import { DownloadPythonButton } from "./actions/DownloadPythonButton";
import { DownloadYamlButton } from "./actions/DownloadYamlButton";
import { DuplicateTaskButton } from "./actions/DuplicateTaskButton";
import { EditComponentButton } from "./actions/EditComponentButton";
import { ViewTaskYamlButton } from "./actions/ViewTaskYamlButton";

interface TaskActionsBarProps {
  yamlText: string;
  taskName: string;
  pythonCode: string | undefined;
  onDuplicate: () => void;
  onDelete: () => void;
}

export function TaskActionsBar({
  yamlText,
  taskName,
  pythonCode,
  onDuplicate,
  onDelete,
}: TaskActionsBarProps) {
  return (
    <ActionBlock
      actions={[
        <DownloadYamlButton
          key="download-yaml"
          yamlText={yamlText}
          taskName={taskName}
        />,
        pythonCode && (
          <DownloadPythonButton
            key="download-python"
            pythonCode={pythonCode}
            fileName={`${taskName}.py`}
          />
        ),
        <CopyYamlButton key="copy-yaml" yamlText={yamlText} />,
        <ViewTaskYamlButton
          key="view-yaml"
          yamlText={yamlText}
          taskName={taskName}
        />,
        <EditComponentButton key="edit" yamlText={yamlText} />,
        <DuplicateTaskButton key="duplicate" onDuplicate={onDuplicate} />,
        <DeleteComponentButton key="delete" onDelete={onDelete} />,
      ].filter(Boolean)}
      className="px-3 py-2"
    />
  );
}
