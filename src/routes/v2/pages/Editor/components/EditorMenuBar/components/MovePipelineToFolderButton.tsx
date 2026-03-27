import { observer } from "mobx-react-lite";
import { useState } from "react";

import TooltipButton from "@/components/shared/Buttons/TooltipButton";
import { Icon } from "@/components/ui/icon";
import { MovePipelineDialog } from "@/routes/PipelineFolders/components/MovePipelineDialog";
import { useEditorSession } from "@/routes/v2/pages/Editor/store/EditorSessionContext";

export const MovePipelineToFolderButton = observer(
  function MovePipelineToFolderButton() {
    const [open, setOpen] = useState(false);
    const { pipelineFile: pipelineFileStore } = useEditorSession();

    const activePipeline = pipelineFileStore.activePipelineFile;

    if (!activePipeline) return null;
    if (!activePipeline.folder.canMoveFilesOut) return null;

    const currentFolderId = activePipeline.folder.id;

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
          pipelineIds={[activePipeline.id]}
          currentFolderId={currentFolderId}
          onMoveComplete={() => setOpen(false)}
        />
      </>
    );
  },
);
