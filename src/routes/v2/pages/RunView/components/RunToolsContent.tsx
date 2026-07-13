import { CancelPipelineRunButton } from "@/components/PipelineRun/components/CancelPipelineRunButton";
import { ClonePipelineButton } from "@/components/PipelineRun/components/ClonePipelineButton";
import { InspectPipelineButton } from "@/components/PipelineRun/components/InspectPipelineButton";
import { RerunPipelineButton } from "@/components/PipelineRun/components/RerunPipelineButton";
import { ViewYamlButton } from "@/components/shared/Buttons/ViewYamlButton";
import { BlockStack } from "@/components/ui/layout";
import { useRunViewActions } from "@/routes/v2/pages/RunView/hooks/useRunViewActions";
import { tracking } from "@/utils/tracking";

const RUN_TOOL_CLASS_NAME =
  "h-10 w-full justify-start gap-3 border-transparent bg-transparent px-3 shadow-none hover:border-border hover:bg-muted";
const RUN_TOOL_WRAPPER_CLASS_NAME = "w-full";

export function RunToolsContent() {
  const actions = useRunViewActions();

  if (!actions.ready) return null;

  const {
    componentSpec,
    runId,
    canAccessEditorSpec,
    isRunCreator,
    isInProgress,
    isComplete,
    pipelineName,
  } = actions;

  return (
    <BlockStack gap="1" className="p-2">
      <ViewYamlButton
        componentSpec={componentSpec}
        displayLabel="View YAML"
        showTooltip={false}
        className={RUN_TOOL_CLASS_NAME}
        wrapperClassName={RUN_TOOL_WRAPPER_CLASS_NAME}
        {...tracking("v2.run_view.tools.view_yaml")}
      />

      {canAccessEditorSpec && pipelineName && (
        <InspectPipelineButton
          pipelineName={pipelineName}
          displayLabel="Inspect pipeline"
          showTooltip={false}
          className={RUN_TOOL_CLASS_NAME}
          wrapperClassName={RUN_TOOL_WRAPPER_CLASS_NAME}
          {...tracking("v2.run_view.tools.inspect_pipeline")}
        />
      )}

      <ClonePipelineButton
        componentSpec={componentSpec}
        runId={runId}
        displayLabel="Clone pipeline"
        showTooltip={false}
        className={RUN_TOOL_CLASS_NAME}
        wrapperClassName={RUN_TOOL_WRAPPER_CLASS_NAME}
        {...tracking("v2.run_view.tools.clone_pipeline")}
      />

      {isInProgress && isRunCreator && (
        <CancelPipelineRunButton
          runId={runId}
          displayLabel="Cancel run"
          showTooltip={false}
          className={`${RUN_TOOL_CLASS_NAME} text-destructive hover:text-destructive`}
          wrapperClassName={RUN_TOOL_WRAPPER_CLASS_NAME}
          {...tracking("v2.run_view.tools.cancel_run")}
        />
      )}

      {isComplete && (
        <RerunPipelineButton
          componentSpec={componentSpec}
          displayLabel="Rerun pipeline"
          showTooltip={false}
          className={RUN_TOOL_CLASS_NAME}
          wrapperClassName={RUN_TOOL_WRAPPER_CLASS_NAME}
          {...tracking("v2.run_view.tools.rerun_pipeline")}
        />
      )}
    </BlockStack>
  );
}
