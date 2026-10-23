import { ActionBlock } from "@/components/shared/ContextPanel/Blocks/ActionBlock";
import { EditorNodeLinkButton } from "@/routes/v2/pages/Editor/components/RemotePipelineNodeLinkButton";

import { DeleteTaskButton } from "./actions/DeleteTaskButton";
import { DuplicateTaskButton } from "./actions/DuplicateTaskButton";
import { UnpackSubgraphButton } from "./actions/UnpackSubgraphButton";

interface TaskActionsBarProps {
  entityId: string;
}

export function TaskActionsBar({ entityId }: TaskActionsBarProps) {
  return (
    <ActionBlock
      actions={[
        <EditorNodeLinkButton key="link" entityId={entityId} nodeType="task" />,
        <UnpackSubgraphButton key="unpack" entityId={entityId} />,
        <DuplicateTaskButton key="duplicate" entityId={entityId} />,
        <DeleteTaskButton key="delete" entityId={entityId} />,
      ]}
      className="w-fit"
    />
  );
}
