import TooltipButton from "@/components/shared/Buttons/TooltipButton";
import ConfirmationDialog from "@/components/shared/Dialogs/ConfirmationDialog";
import { StatusBar } from "@/components/shared/Status";
import TaskImplementation from "@/components/shared/TaskDetails/Implementation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { useCancelPipelineRun } from "@/routes/v2/pages/RunView/hooks/useCancelPipelineRun";
import { useClonePipelineRun } from "@/routes/v2/pages/RunView/hooks/useClonePipelineRun";
import { useExportPipelineYaml } from "@/routes/v2/pages/RunView/hooks/useExportPipelineYaml";
import { useInspectPipeline } from "@/routes/v2/pages/RunView/hooks/useInspectPipeline";
import { useRerunPipelineRun } from "@/routes/v2/pages/RunView/hooks/useRerunPipelineRun";
import { useRunViewActions } from "@/routes/v2/pages/RunView/hooks/useRunViewActions";
import { useYamlViewer } from "@/routes/v2/pages/RunView/hooks/useYamlViewer";
import type { ExecutionStatusStats } from "@/utils/executionStatus";
import { tracking } from "@/utils/tracking";

interface RunActionsBarProps {
  executionStatusStats: ExecutionStatusStats | null | undefined;
  statusLabel: string;
}

export function RunActionsBar({
  executionStatusStats,
  statusLabel,
}: RunActionsBarProps) {
  const actions = useRunViewActions();
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

  const status = (
    <BlockStack gap="1" className="min-w-0 flex-1">
      <Text size="xs" weight="semibold" className="truncate">
        {statusLabel}
      </Text>
      <StatusBar executionStatusStats={executionStatusStats} />
    </BlockStack>
  );

  if (!actions.ready) {
    return (
      <InlineStack
        gap="2"
        blockAlign="center"
        wrap="nowrap"
        className="w-full rounded-md border px-2 py-1"
      >
        {status}
      </InlineStack>
    );
  }

  const { canAccessEditorSpec, isRunCreator, isInProgress, isComplete } =
    actions;
  const showCancel = isInProgress && isRunCreator;
  const showSeparator = showCancel || isComplete;

  return (
    <>
      <InlineStack
        gap="2"
        blockAlign="center"
        wrap="nowrap"
        className="w-full rounded-md border px-2 py-1"
      >
        {status}

        <InlineStack blockAlign="center" className="shrink-0">
          <TooltipButton
            variant="ghost"
            size="min"
            onClick={openYamlViewer}
            tooltip="View YAML"
            {...tracking("v2.run_view.menu_bar.view_yaml")}
          >
            <Icon name="FileCode" size="sm" />
          </TooltipButton>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="min">
                <Icon name="EllipsisVertical" size="sm" />
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end">
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
        </InlineStack>
      </InlineStack>

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
