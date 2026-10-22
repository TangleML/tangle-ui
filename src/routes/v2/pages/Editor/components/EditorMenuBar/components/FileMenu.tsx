import { useNavigate } from "@tanstack/react-router";
import { observer } from "mobx-react-lite";

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
import { useAnalytics } from "@/providers/AnalyticsProvider";
import { useTourMode } from "@/providers/TourProvider/TourModeContext";
import { APP_ROUTES } from "@/routes/router";
import { MenuTriggerButton } from "@/routes/v2/shared/components/MenuTriggerButton";
import { ShortcutBadge } from "@/routes/v2/shared/components/ShortcutBadge";
import { tracking } from "@/utils/tracking";

import { useFileMenuState } from "./useFileMenuState";

export const FileMenu = observer(function FileMenu() {
  const { track } = useAnalytics();
  const {
    importTriggerRef,
    saveAsDialogOpen,
    setSaveAsDialogOpen,
    renameDialogOpen,
    setRenameDialogOpen,
    renamePipeline,
    getRenameInitialName,
    setImportOpen,
    handleSave,
    handleNewPipeline,
    handleSavePipelineAs,
    handleExport,
    getSaveAsInitialName,
  } = useFileMenuState();

  const navigate = useNavigate();
  const tourMode = useTourMode();

  const isTour = !!tourMode;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <MenuTriggerButton {...tracking("v2.pipeline_editor.file_menu")}>
            File
          </MenuTriggerButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" sideOffset={2}>
          <DropdownMenuItem
            disabled={isTour}
            onClick={() => {
              track("v2.pipeline_editor.file_menu.open.click");
              void navigate({ to: APP_ROUTES.DASHBOARD_PIPELINES });
            }}
          >
            <Icon name="FolderOpen" size="sm" />
            Open
            <DropdownMenuShortcut>
              <ShortcutBadge id="open-pipeline" />
            </DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={isTour}
            onClick={() => {
              track("v2.pipeline_editor.file_menu.save.click");
              void handleSave();
            }}
          >
            <Icon name="Save" size="sm" />
            Save
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={isTour}
            onClick={() => {
              track("v2.pipeline_editor.file_menu.save_as.click");
              setSaveAsDialogOpen(true);
            }}
          >
            <Icon name="SaveAll" size="sm" />
            Save as
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={isTour}
            onClick={() => {
              track("v2.pipeline_editor.file_menu.rename.click");
              setRenameDialogOpen(true);
            }}
          >
            <Icon name="Pencil" size="sm" />
            Rename
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={isTour}
            onClick={() => {
              track("v2.pipeline_editor.file_menu.new_pipeline.click");
              void handleNewPipeline();
            }}
          >
            <Icon name="Plus" size="sm" />
            New pipeline
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={isTour}
            onClick={() => {
              track("v2.pipeline_editor.file_menu.import.click");
              setImportOpen(true);
            }}
          >
            <Icon name="Upload" size="sm" />
            Import
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              track("v2.pipeline_editor.file_menu.export.click");
              void handleExport();
            }}
          >
            <Icon name="FileDown" size="sm" />
            Export
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

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
        onSubmit={renamePipeline}
        submitButtonText="Rename"
        isSubmitDisabled={(name) => name === getRenameInitialName()}
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
        onImportComplete={(pipeline) => {
          navigate({
            to: APP_ROUTES.REMOTE_PIPELINE_EDITOR,
            params: { pipelineId: pipeline.pipelineId },
          });
        }}
      />
    </>
  );
});
