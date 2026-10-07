import TooltipButton from "@/components/shared/Buttons/TooltipButton";
import { useFlagValue } from "@/components/shared/Settings/useFlags";
import { Icon } from "@/components/ui/icon";
import { useCollabServerInfo } from "@/routes/v2/pages/PipelineFolders/hooks/useCollabServerInfo";
import { useEnableCollaboration } from "@/routes/v2/pages/PipelineFolders/hooks/useEnableCollaboration";
import type { CollabStorageMode } from "@/services/collaboration/serverInfo";
import type { PipelineFile } from "@/services/pipelineStorage/PipelineFile";
import { tracking } from "@/utils/tracking";

const SERVER_UNAVAILABLE_TOOLTIP =
  "The collaboration server is unavailable. Check its URL in Settings.";

const STORAGE_TOOLTIPS: Record<CollabStorageMode, string | undefined> = {
  ephemeral:
    "Starts a temporary shared copy on the collaboration server. Edits are not saved back to this pipeline.",
  backend: undefined,
};

interface CollaborationButtonProps {
  disabled: boolean;
  tooltip?: string;
  onClick?: () => void;
  storage?: CollabStorageMode;
}

function CollaborationButton({
  disabled,
  tooltip,
  onClick,
  storage,
}: CollaborationButtonProps) {
  return (
    <TooltipButton
      variant="outline"
      size="sm"
      disabled={disabled}
      tooltip={tooltip}
      onClick={onClick}
      {...tracking(
        "v2.pipeline_folders.table.enable_collaboration",
        storage ? { storage } : undefined,
      )}
    >
      <Icon name="Users" />
      Enable collaboration
    </TooltipButton>
  );
}

function ReadyEnableCollaborationButton({
  pipeline,
  storage,
}: {
  pipeline: PipelineFile;
  storage: CollabStorageMode;
}) {
  const { mutate: enableCollaboration, isPending } =
    useEnableCollaboration(storage);

  return (
    <CollaborationButton
      disabled={isPending}
      tooltip={STORAGE_TOOLTIPS[storage]}
      onClick={() => enableCollaboration(pipeline)}
      storage={storage}
    />
  );
}

function ServerAwareEnableCollaborationButton({
  pipeline,
}: {
  pipeline: PipelineFile;
}) {
  const { data: serverInfo, isError } = useCollabServerInfo();

  if (!serverInfo) {
    return (
      <CollaborationButton
        disabled
        tooltip={isError ? SERVER_UNAVAILABLE_TOOLTIP : undefined}
      />
    );
  }

  return (
    <ReadyEnableCollaborationButton
      pipeline={pipeline}
      storage={serverInfo.storage}
    />
  );
}

export function EnableCollaborationButton({
  pipeline,
}: {
  pipeline: PipelineFile | undefined;
}) {
  const collabEnabled = useFlagValue("collab-poc");

  if (!collabEnabled || !pipeline) return null;

  return <ServerAwareEnableCollaborationButton pipeline={pipeline} />;
}
