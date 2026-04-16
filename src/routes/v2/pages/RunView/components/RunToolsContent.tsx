import { CancelPipelineRunButton } from "@/components/PipelineRun/components/CancelPipelineRunButton";
import { ClonePipelineButton } from "@/components/PipelineRun/components/ClonePipelineButton";
import { InspectPipelineButton } from "@/components/PipelineRun/components/InspectPipelineButton";
import { RerunPipelineButton } from "@/components/PipelineRun/components/RerunPipelineButton";
import { ViewYamlButton } from "@/components/shared/Buttons/ViewYamlButton";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { useRunViewActions } from "@/routes/v2/pages/RunView/hooks/useRunViewActions";

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
        <ViewYamlButton componentSpec={componentSpec} displayLabel="View" />

        {canAccessEditorSpec && pipelineName && (
          <InspectPipelineButton pipelineName={pipelineName} showLabel />
        )}

        <ClonePipelineButton
          componentSpec={componentSpec}
          runId={runId}
          showLabel
        />

        {isInProgress && isRunCreator && (
          <CancelPipelineRunButton runId={runId} showLabel />
        )}

        {isComplete && (
          <RerunPipelineButton componentSpec={componentSpec} showLabel />
        )}
      </InlineStack>
    </BlockStack>
  );
}
