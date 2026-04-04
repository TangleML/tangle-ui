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
import { MenuTriggerButton } from "@/routes/v2/shared/components/MenuTriggerButton";
import { ShorcutBadge } from "@/routes/v2/shared/components/ShorcutBadge";

import { OpenPipelineDialog } from "./OpenPipelineDialog";
import { useFileMenuState } from "./useFileMenuState";

export function FileMenu() {
  const {
    importTriggerRef,
    openDialogOpen,
    setOpenDialogOpen,
    saveAsDialogOpen,
    setSaveAsDialogOpen,
    setImportOpen,
    handleSave,
    handleNewPipeline,
    handlePipelineClick,
    handleSavePipelineAs,
    handleExport,
    getSaveAsInitialName,
  } = useFileMenuState();

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
              <ShorcutBadge id="open-pipeline" />
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

      <ImportPipeline
        triggerComponent={
          <button
            ref={importTriggerRef}
            className="sr-only"
            aria-hidden
            tabIndex={-1}
          />
        }
      />
    </>
  );
}
