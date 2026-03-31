import { ActionBlock } from "@/components/shared/ContextPanel/Blocks/ActionBlock";
import { useFlagValue } from "@/components/shared/Settings/useFlags";

import { CopyYamlButton } from "./actions/CopyYamlButton";
import { DeleteTaskButton } from "./actions/DeleteTaskButton";
import { DownloadPythonButton } from "./actions/DownloadPythonButton";
import { DownloadYamlButton } from "./actions/DownloadYamlButton";
import { DuplicateTaskButton } from "./actions/DuplicateTaskButton";
import { EditComponentButton } from "./actions/EditComponentButton";
import { UnpackSubgraphButton } from "./actions/UnpackSubgraphButton";
import { ViewTaskYamlButton } from "./actions/ViewTaskYamlButton";

interface TaskActionsBarProps {
  entityId: string;
}

export function TaskActionsBar({ entityId }: TaskActionsBarProps) {
  const showComponentRefBar = useFlagValue("task-component-ref-bar");
  const showComponentActions = !showComponentRefBar;

  return (
    <ActionBlock
      actions={[
        showComponentActions && (
          <DownloadYamlButton key="download-yaml" entityId={entityId} />
        ),
        showComponentActions && (
          <DownloadPythonButton key="download-python" entityId={entityId} />
        ),
        showComponentActions && (
          <CopyYamlButton key="copy-yaml" entityId={entityId} />
        ),
        showComponentActions && (
          <ViewTaskYamlButton key="view-yaml" entityId={entityId} />
        ),
        showComponentActions && (
          <EditComponentButton key="edit" entityId={entityId} />
        ),
        <UnpackSubgraphButton key="unpack" entityId={entityId} />,
        <DuplicateTaskButton key="duplicate" entityId={entityId} />,
        <DeleteTaskButton key="delete" entityId={entityId} />,
      ].filter(Boolean)}
      className="w-fit"
    />
  );
}
