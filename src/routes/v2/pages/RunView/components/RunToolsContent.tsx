import { observer } from "mobx-react-lite";

import { CancelPipelineRunButton } from "@/components/PipelineRun/components/CancelPipelineRunButton";
import { ClonePipelineButton } from "@/components/PipelineRun/components/ClonePipelineButton";
import { InspectPipelineButton } from "@/components/PipelineRun/components/InspectPipelineButton";
import { RerunPipelineButton } from "@/components/PipelineRun/components/RerunPipelineButton";
import { SharePipelineButton } from "@/components/PipelineRun/components/SharePipelineButton";
import { ViewYamlButton } from "@/components/shared/Buttons/ViewYamlButton";
import { useRunViewActions } from "@/routes/v2/pages/RunView/hooks/useRunViewActions";
import { ToolsPanel } from "@/routes/v2/shared/components/ToolsPanel";
import { tracking } from "@/utils/tracking";

const CANCEL_TOOL_CLASS_NAME =
  "text-destructive hover:text-destructive dark:text-red-400 dark:hover:text-red-400 border-destructive/50 dark:border-red-400/30 hover:bg-destructive/10 dark:hover:bg-red-400/10";

interface RunToolsContentProps {
  layout?: "rail";
}

export const RunToolsContent = observer(function RunToolsContent({
  layout,
}: RunToolsContentProps) {
  const actions = useRunViewActions();
  if (!actions.ready) return null;

  const {
    componentSpec,
    runId,
    canAccessEditorSpec,
    management,
    isInProgress,
    isComplete,
    pipelineName,
  } = actions;

  return (
    <ToolsPanel layout={layout}>
      {({ isRail, className, wrapperClassName, tooltipSide }) => (
        <>
          <ViewYamlButton
            componentSpec={componentSpec}
            displayLabel={isRail ? undefined : "View YAML"}
            aria-label="View YAML"
            showTooltip={isRail}
            tooltipSide={tooltipSide}
            className={className}
            wrapperClassName={wrapperClassName}
            {...tracking("v2.run_view.tools.view_yaml")}
          />

          <SharePipelineButton
            runId={runId}
            displayLabel={isRail ? undefined : "Share run"}
            aria-label="Share run"
            showTooltip={isRail}
            tooltipSide={tooltipSide}
            className={className}
            wrapperClassName={wrapperClassName}
            {...tracking("v2.run_view.tools.share_pipeline")}
          />

          {canAccessEditorSpec && pipelineName && (
            <InspectPipelineButton
              pipelineName={pipelineName}
              displayLabel={isRail ? undefined : "Inspect pipeline"}
              aria-label="Inspect pipeline"
              showTooltip={isRail}
              tooltipSide={tooltipSide}
              className={className}
              wrapperClassName={wrapperClassName}
              {...tracking("v2.run_view.tools.inspect_pipeline")}
            />
          )}

          <ClonePipelineButton
            componentSpec={componentSpec}
            runId={runId}
            displayLabel={isRail ? undefined : "Clone pipeline"}
            aria-label="Clone pipeline"
            showTooltip={isRail}
            tooltipSide={tooltipSide}
            className={className}
            wrapperClassName={wrapperClassName}
            {...tracking("v2.run_view.tools.clone_pipeline")}
          />

          {isInProgress && management.canManage && (
            <CancelPipelineRunButton
              runId={runId}
              teamId={management.teamId}
              displayLabel={isRail ? undefined : "Cancel run"}
              aria-label="Cancel run"
              showTooltip={isRail}
              tooltipSide={tooltipSide}
              className={`${className} bg-transparent ${CANCEL_TOOL_CLASS_NAME}`}
              wrapperClassName={wrapperClassName}
              {...tracking("v2.run_view.tools.cancel_run")}
            />
          )}

          {isComplete && (
            <RerunPipelineButton
              componentSpec={componentSpec}
              displayLabel={isRail ? undefined : "Rerun pipeline"}
              aria-label="Rerun pipeline"
              showTooltip={isRail}
              tooltipSide={tooltipSide}
              className={className}
              wrapperClassName={wrapperClassName}
              {...tracking("v2.run_view.tools.rerun_pipeline")}
            />
          )}
        </>
      )}
    </ToolsPanel>
  );
});
