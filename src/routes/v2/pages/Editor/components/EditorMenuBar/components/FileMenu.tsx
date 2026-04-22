import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { PipelineNameDialog } from "@/components/shared/Dialogs";
import ImportPipeline from "@/components/shared/ImportPipeline";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import { APP_ROUTES } from "@/routes/router";
import { useEditorSession } from "@/routes/v2/pages/Editor/store/EditorSessionContext";
import { MenuTriggerButton } from "@/routes/v2/shared/components/MenuTriggerButton";
import { MovePipelineDialog } from "@/routes/v2/shared/components/MovePipelineDialog";
import { ShortcutBadge } from "@/routes/v2/shared/components/ShortcutBadge";

import { OpenPipelineDialog } from "./OpenPipelineDialog";
import { useFileMenuState } from "./useFileMenuState";

export function FileMenu() {
  const {
    importTriggerRef,
    openDialogOpen,
    setOpenDialogOpen,
    saveAsDialogOpen,
    setSaveAsDialogOpen,
    renameDialogOpen,
    setRenameDialogOpen,
    handleRename,
    getRenameInitialName,
    setImportOpen,
    handleSave,
    handleNewPipeline,
    handlePipelineClick,
    handleSavePipelineAs,
    handleExport,
    getSaveAsInitialName,
  } = useFileMenuState();

  const navigate = useNavigate();
  const { pipelineFile: pipelineFileStore } = useEditorSession();
  const activePipeline = pipelineFileStore.activePipelineFile;
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const canMove = activePipeline?.folder.canMoveFilesOut ?? false;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <MenuTriggerButton>File</MenuTriggerButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" sideOffset={2}>
          <DropdownMenuItem onClick={() => setOpenDialogOpen(true)}>
            <Icon name="FolderOpen" size="sm" />
            Open
            <DropdownMenuShortcut>
              <ShortcutBadge id="open-pipeline" />
            </DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleSave}>
            <Icon name="Save" size="sm" />
            Save
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setSaveAsDialogOpen(true)}>
            <Icon name="SaveAll" size="sm" />
            Save as
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setRenameDialogOpen(true)}>
            <Icon name="Pencil" size="sm" />
            Rename
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleNewPipeline}>
            <Icon name="Plus" size="sm" />
            New pipeline
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setImportOpen(true)}>
            <Icon name="Upload" size="sm" />
            Import
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleExport}>
            <Icon name="FileDown" size="sm" />
            Export
          </DropdownMenuItem>
          {canMove && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setMoveDialogOpen(true)}>
                <Icon name="Folder" size="sm" />
                Move to folder
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <OpenPipelineDialog
        open={openDialogOpen}
        onOpenChange={setOpenDialogOpen}
        onPipelineClick={handlePipelineClick}
      />

      <PipelineNameDialog
        open={saveAsDialogOpen}
        onOpenChange={setSaveAsDialogOpen}
        title="Save Pipeline As"
        description="Enter a name for your pipeline"
        initialName={getSaveAsInitialName()}
        onSubmit={handleSavePipelineAs}
        submitButtonText="Save"
      />

      <PipelineNameDialog
        open={renameDialogOpen}
        onOpenChange={setRenameDialogOpen}
        title="Rename Pipeline"
        initialName={getRenameInitialName()}
        onSubmit={handleRename}
        submitButtonText="Rename"
        isSubmitDisabled={(name) => name === getRenameInitialName()}
      />

      {canMove && activePipeline && (
        <MovePipelineDialog
          open={moveDialogOpen}
          onOpenChange={setMoveDialogOpen}
          pipelineIds={[activePipeline.id]}
          currentFolderId={activePipeline.folder.id}
          onMoveComplete={() => setMoveDialogOpen(false)}
        />
      )}

      <ImportPipeline
        triggerComponent={
          <button
            ref={importTriggerRef}
            className="sr-only"
            aria-hidden
            tabIndex={-1}
          />
        }
        onImportComplete={(pipeline) => {
          navigate({
            to: APP_ROUTES.EDITOR_V2_PIPELINE,
            params: { pipelineName: pipeline.name },
            search: { fileId: pipeline.fileId },
          });
        }}
      />
    </>
  );
}
