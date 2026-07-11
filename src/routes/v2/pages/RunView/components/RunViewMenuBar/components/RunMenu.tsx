import { useNavigate } from "@tanstack/react-router";

import ConfirmationDialog from "@/components/shared/Dialogs/ConfirmationDialog";
import { useFlagValue } from "@/components/shared/Settings/useFlags";
import TaskImplementation from "@/components/shared/TaskDetails/Implementation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import { APP_ROUTES } from "@/routes/appRoutes";
import { useCancelPipelineRun } from "@/routes/v2/pages/RunView/hooks/useCancelPipelineRun";
import { useClonePipelineRun } from "@/routes/v2/pages/RunView/hooks/useClonePipelineRun";
import { useExportPipelineYaml } from "@/routes/v2/pages/RunView/hooks/useExportPipelineYaml";
import { useInspectPipeline } from "@/routes/v2/pages/RunView/hooks/useInspectPipeline";
import { useRerunPipelineRun } from "@/routes/v2/pages/RunView/hooks/useRerunPipelineRun";
import { useRunViewActions } from "@/routes/v2/pages/RunView/hooks/useRunViewActions";
import { useYamlViewer } from "@/routes/v2/pages/RunView/hooks/useYamlViewer";
import { MenuTriggerButton } from "@/routes/v2/shared/components/MenuTriggerButton";
import { tracking } from "@/utils/tracking";

export function RunMenu() {
  const navigate = useNavigate();
  const actions = useRunViewActions();
  const compareEnabled = useFlagValue("compare-runs");
  const componentSpec = actions.ready ? actions.componentSpec : undefined;
  const runId = actions.ready ? actions.runId : undefined;
  const pipelineName = actions.ready ? actions.pipelineName : undefined;

  const { yamlViewerOpen, openYamlViewer, closeYamlViewer } = useYamlViewer();
  const { clone, isCloning } = useClonePipelineRun(componentSpec, runId);
  const { rerun, isRerunning } = useRerunPipelineRun(componentSpec);
  const {
    cancelDialogOpen,
    isCancelling,
    requestCancel,
    confirmCancel,
    dismissCancel,
  } = useCancelPipelineRun(runId);
  const { inspect } = useInspectPipeline(pipelineName);
  const { exportYaml } = useExportPipelineYaml(componentSpec, pipelineName);

  const handleCompare = () => {
    if (runId) {
      navigate({ to: APP_ROUTES.COMPARE, search: { a: runId } });
    }
  };

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

  const { canAccessEditorSpec, isRunCreator, isInProgress, isComplete } =
    actions;
  const showCancel = isInProgress && isRunCreator;
  const showSeparator = showCancel || isComplete;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <MenuTriggerButton {...tracking("v2.run_view.menu_bar.run_menu")}>
            Run
          </MenuTriggerButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" sideOffset={2}>
          {canAccessEditorSpec && pipelineName && (
            <DropdownMenuItem
              onSelect={inspect}
              {...tracking("v2.run_view.menu_bar.inspect_pipeline")}
            >
              <Icon name="ExternalLink" size="sm" />
              Inspect Pipeline
            </DropdownMenuItem>
          )}

          <DropdownMenuItem
            onSelect={openYamlViewer}
            {...tracking("v2.run_view.menu_bar.view_yaml")}
          >
            <Icon name="FileCode" size="sm" />
            View YAML
          </DropdownMenuItem>

          {compareEnabled && runId && (
            <DropdownMenuItem
              onSelect={handleCompare}
              {...tracking("compare_runs.run_view.compare_with_another")}
            >
              <Icon name="GitCompare" size="sm" />
              Compare with another run…
            </DropdownMenuItem>
          )}

          <DropdownMenuItem
            onSelect={clone}
            disabled={isCloning}
            {...tracking("v2.run_view.menu_bar.clone_pipeline")}
          >
            <Icon name="CopyPlus" size="sm" />
            Clone Pipeline
          </DropdownMenuItem>

          <DropdownMenuItem
            onSelect={exportYaml}
            {...tracking("v2.run_view.menu_bar.export_yaml")}
          >
            <Icon name="FileDown" size="sm" />
            Export YAML
          </DropdownMenuItem>

          {showSeparator && <DropdownMenuSeparator />}

          {showCancel && (
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
              onSelect={rerun}
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
          displayName={pipelineName ?? componentSpec?.name ?? "Pipeline"}
          fullscreen
          onClose={closeYamlViewer}
        />
      )}
    </>
  );
}
