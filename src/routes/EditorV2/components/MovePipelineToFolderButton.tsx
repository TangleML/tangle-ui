import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import TooltipButton from "@/components/shared/Buttons/TooltipButton";
import { Icon } from "@/components/ui/icon";
import { MovePipelineDialog } from "@/routes/PipelineFolders/components/MovePipelineDialog";
import { getPipelineFolderAssignment } from "@/routes/PipelineFolders/services/folderStorage";
import { FoldersQueryKeys } from "@/routes/PipelineFolders/types";

interface MovePipelineToFolderButtonProps {
  pipelineName: string;
}

export function MovePipelineToFolderButton({
  pipelineName,
}: MovePipelineToFolderButtonProps) {
  const [open, setOpen] = useState(false);

  const { data: currentFolderId = null } = useQuery({
    // todo: move to separate query hook
    // todo: handle corresponding key
    queryKey: [...FoldersQueryKeys.All(), "assignment", pipelineName],
    queryFn: () => getPipelineFolderAssignment(pipelineName),
    enabled: open,
  });

  return (
    <>
      <TooltipButton
        tooltip="Move to folder"
        variant="ghost"
        size="icon"
        data-testid="move-pipeline-folders-button"
        onClick={() => setOpen(true)}
      >
        <Icon name="Folder" size="sm" className="text-stone-400" />
      </TooltipButton>

      <MovePipelineDialog
        open={open}
        onOpenChange={setOpen}
        pipelineNames={[pipelineName]}
        currentFolderId={currentFolderId}
        onMoveComplete={() => setOpen(false)}
      />
    </>
  );
}
