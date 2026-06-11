import ConfirmationDialog from "@/components/shared/Dialogs/ConfirmationDialog";
import TaskImplementation from "@/components/shared/TaskDetails/Implementation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import { MenuTriggerButton } from "@/routes/v2/shared/components/MenuTriggerButton";
import { tracking } from "@/utils/tracking";

import { useRunMenuActions } from "./useRunMenuActions";

export function RunMenu() {
  const {
    actions,
    yamlViewerOpen,
    cancelDialogOpen,
    isCloning,
    isCancelling,
    isRerunning,
    openYamlViewer,
    closeYamlViewer,
    requestCancel,
    dismissCancel,
    handleInspect,
    handleClone,
    confirmCancel,
    handleRerun,
    handleExportYaml,
  } = useRunMenuActions();

  if (!actions.ready) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <MenuTriggerButton
            disabled
            {...tracking("v2.run_view.menu_bar.run_menu")}
          >
            Run
          </MenuTriggerButton>
        </DropdownMenuTrigger>
      </DropdownMenu>
    );
  }

  const {
    componentSpec,
    canAccessEditorSpec,
    isRunCreator,
    isInProgress,
    isComplete,
    pipelineName,
  } = actions;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <MenuTriggerButton {...tracking("v2.run_view.menu_bar.run_menu")}>
            Run
          </MenuTriggerButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" sideOffset={2}>
          <DropdownMenuItem
            onSelect={openYamlViewer}
            {...tracking("v2.run_view.menu_bar.view_yaml")}
          >
            <Icon name="FileCode" size="sm" />
            View YAML
          </DropdownMenuItem>

          {canAccessEditorSpec && pipelineName && (
            <DropdownMenuItem
              onSelect={handleInspect}
              {...tracking("v2.run_view.menu_bar.inspect_pipeline")}
            >
              <Icon name="ExternalLink" size="sm" />
              Inspect Pipeline
            </DropdownMenuItem>
          )}

          <DropdownMenuItem
            onSelect={handleClone}
            disabled={isCloning}
            {...tracking("v2.run_view.menu_bar.clone_pipeline")}
          >
            <Icon name="CopyPlus" size="sm" />
            Clone Pipeline
          </DropdownMenuItem>

          <DropdownMenuItem
            onSelect={handleExportYaml}
            {...tracking("v2.run_view.menu_bar.export_yaml")}
          >
            <Icon name="FileDown" size="sm" />
            Export YAML
          </DropdownMenuItem>

          {(isInProgress && isRunCreator) || isComplete ? (
            <DropdownMenuSeparator />
          ) : null}

          {isInProgress && isRunCreator && (
            <DropdownMenuItem
              onSelect={requestCancel}
              disabled={isCancelling}
              className="text-destructive focus:text-destructive"
              {...tracking("v2.run_view.menu_bar.cancel_run")}
            >
              <Icon name="CircleX" size="sm" />
              Cancel Run
            </DropdownMenuItem>
          )}

          {isComplete && (
            <DropdownMenuItem
              onSelect={handleRerun}
              disabled={isRerunning}
              {...tracking("v2.run_view.menu_bar.rerun_pipeline")}
            >
              <Icon name="RefreshCcw" size="sm" />
              Rerun Pipeline
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmationDialog
        isOpen={cancelDialogOpen}
        title="Cancel run"
        description="The run will be scheduled for cancellation. This action cannot be undone."
        onConfirm={confirmCancel}
        onCancel={dismissCancel}
      />

      {yamlViewerOpen && (
        <TaskImplementation
          componentSpec={componentSpec}
          displayName={pipelineName ?? componentSpec.name ?? "Pipeline"}
          fullscreen
          onClose={closeYamlViewer}
        />
      )}
    </>
  );
}
