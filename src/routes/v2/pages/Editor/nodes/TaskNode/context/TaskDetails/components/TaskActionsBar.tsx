import { ActionBlock } from "@/components/shared/ContextPanel/Blocks/ActionBlock";

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
        <UnpackSubgraphButton key="unpack" entityId={entityId} />,
        <DuplicateTaskButton key="duplicate" entityId={entityId} />,
        <DeleteTaskButton key="delete" entityId={entityId} />,
      ]}
      className="w-fit"
    />
  );
}
