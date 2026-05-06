import { CancelPipelineRunButton } from "@/components/PipelineRun/components/CancelPipelineRunButton";
import { ClonePipelineButton } from "@/components/PipelineRun/components/ClonePipelineButton";
import { InspectPipelineButton } from "@/components/PipelineRun/components/InspectPipelineButton";
import { RerunPipelineButton } from "@/components/PipelineRun/components/RerunPipelineButton";
import { ViewYamlButton } from "@/components/shared/Buttons/ViewYamlButton";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { useRunViewActions } from "@/routes/v2/pages/RunView/hooks/useRunViewActions";
import { tracking } from "@/utils/tracking";

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
    <BlockStack gap="2" className="p-2">
      <InlineStack gap="2">
        <ViewYamlButton
          componentSpec={componentSpec}
          displayLabel="View"
          {...tracking("v2.run_view.tools.view_yaml")}
        />

        {canAccessEditorSpec && pipelineName && (
          <InspectPipelineButton
            pipelineName={pipelineName}
            showLabel
            {...tracking("v2.run_view.tools.inspect_pipeline")}
          />
        )}

        <ClonePipelineButton
          componentSpec={componentSpec}
          runId={runId}
          showLabel
          {...tracking("v2.run_view.tools.clone_pipeline")}
        />

        {isInProgress && isRunCreator && (
          <CancelPipelineRunButton
            runId={runId}
            showLabel
            {...tracking("v2.run_view.tools.cancel_run")}
          />
        )}

        {isComplete && (
          <RerunPipelineButton
            componentSpec={componentSpec}
            showLabel
            {...tracking("v2.run_view.tools.rerun_pipeline")}
          />
        )}
      </InlineStack>
    </BlockStack>
  );
}
