import { CancelPipelineRunButton } from "@/components/PipelineRun/components/CancelPipelineRunButton";
import { ClonePipelineButton } from "@/components/PipelineRun/components/ClonePipelineButton";
import { InspectPipelineButton } from "@/components/PipelineRun/components/InspectPipelineButton";
import { RerunPipelineButton } from "@/components/PipelineRun/components/RerunPipelineButton";
import { ViewYamlButton } from "@/components/shared/Buttons/ViewYamlButton";
import { buildTaskSpecShape } from "@/components/shared/PipelineRunNameTemplate/types";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { useCheckComponentSpecFromPath } from "@/hooks/useCheckComponentSpecFromPath";
import { useUserDetails } from "@/hooks/useUserDetails";
import { useComponentSpec } from "@/providers/ComponentSpecProvider";
import { useExecutionData } from "@/providers/ExecutionDataProvider";
import { extractCanonicalName } from "@/utils/canonicalPipelineName";
import {
  countInProgressFromStats,
  flattenExecutionStatusStats,
  isExecutionComplete,
} from "@/utils/executionStatus";

export function RunToolsContent() {
  const { componentSpec } = useComponentSpec();
  const {
    rootState: state,
    runId,
    metadata,
    rootDetails: details,
  } = useExecutionData();
  const { data: currentUserDetails } = useUserDetails();

  const editorRoute = componentSpec?.name
    ? `/editor/${encodeURIComponent(componentSpec.name)}`
    : "";

  const canAccessEditorSpec = useCheckComponentSpecFromPath(
    editorRoute,
    componentSpec,
  );

  const isRunCreator =
    currentUserDetails?.id && metadata?.created_by === currentUserDetails.id;

  if (!componentSpec || !state) {
    return null;
  }

  const executionStatusStats =
    metadata?.execution_status_stats ??
    flattenExecutionStatusStats(state.child_execution_status_stats);

  const isInProgress = countInProgressFromStats(executionStatusStats) > 0;
  const isComplete = isExecutionComplete(executionStatusStats);

  const pipelineName =
    extractCanonicalName(
      buildTaskSpecShape(details?.task_spec, componentSpec),
    ) ?? componentSpec.name;

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
