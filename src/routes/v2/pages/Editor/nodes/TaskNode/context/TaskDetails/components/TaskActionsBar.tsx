import { ActionBlock } from "@/components/shared/ContextPanel/Blocks/ActionBlock";
import { useFlagValue } from "@/components/shared/Settings/useFlags";
import { DeleteComponentButton } from "@/components/shared/TaskDetails/Actions/DeleteComponentButton";

import { CopyYamlButton } from "./actions/CopyYamlButton";
import { DownloadPythonButton } from "./actions/DownloadPythonButton";
import { DownloadYamlButton } from "./actions/DownloadYamlButton";
import { DuplicateTaskButton } from "./actions/DuplicateTaskButton";
import { EditComponentButton } from "./actions/EditComponentButton";
import { UnpackSubgraphButton } from "./actions/UnpackSubgraphButton";
import { ViewTaskYamlButton } from "./actions/ViewTaskYamlButton";

interface TaskActionsBarProps {
  yamlText: string;
  taskName: string;
  pythonCode: string | undefined;
  isSubgraph: boolean;
  onDuplicate: () => void;
  onDelete: () => void;
  onUnpackSubgraph: () => void;
}

export function TaskActionsBar({
  yamlText,
  taskName,
  pythonCode,
  isSubgraph,
  onDuplicate,
  onDelete,
  onUnpackSubgraph,
}: TaskActionsBarProps) {
  const showComponentRefBar = useFlagValue("task-component-ref-bar");
  const showComponentActions = !showComponentRefBar;

  return (
    <ActionBlock
      actions={[
        showComponentActions && (
          <DownloadYamlButton
            key="download-yaml"
            yamlText={yamlText}
            taskName={taskName}
          />
        ),
        showComponentActions && pythonCode && (
          <DownloadPythonButton
            key="download-python"
            pythonCode={pythonCode}
            fileName={`${taskName}.py`}
          />
        ),
        showComponentActions && (
          <CopyYamlButton key="copy-yaml" yamlText={yamlText} />
        ),
        showComponentActions && (
          <ViewTaskYamlButton
            key="view-yaml"
            yamlText={yamlText}
            taskName={taskName}
          />
        ),
        showComponentActions && (
          <EditComponentButton key="edit" yamlText={yamlText} />
        ),
        isSubgraph && (
          <UnpackSubgraphButton key="unpack" onUnpack={onUnpackSubgraph} />
        ),
        <DuplicateTaskButton key="duplicate" onDuplicate={onDuplicate} />,
        <DeleteComponentButton key="delete" onDelete={onDelete} />,
      ].filter(Boolean)}
      className="w-fit"
    />
  );
}
