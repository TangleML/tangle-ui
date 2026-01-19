import { InlineStack } from "@/components/ui/layout";
import { useCheckComponentSpecFromPath } from "@/hooks/useCheckComponentSpecFromPath";
import { useUserDetails } from "@/hooks/useUserDetails";
import { cn } from "@/lib/utils";
import { useComponentSpec } from "@/providers/ComponentSpecProvider";
import { useExecutionData } from "@/providers/ExecutionDataProvider";
import {
  countInProgressFromStats,
  flattenExecutionStatusStats,
  isExecutionComplete,
} from "@/utils/executionStatus";

import { ViewYamlButton } from "../shared/Buttons/ViewYamlButton";
import { CancelPipelineRunButton } from "./components/CancelPipelineRunButton";
import { ClonePipelineButton } from "./components/ClonePipelineButton";
import { InspectPipelineButton } from "./components/InspectPipelineButton";
import { RerunPipelineButton } from "./components/RerunPipelineButton";

export const RunToolbar = () => {
  const { componentSpec, currentSubgraphPath } = useComponentSpec();
  const { rootState: state, runId, metadata } = useExecutionData();
  const { data: currentUserDetails } = useUserDetails();

  const editorRoute = componentSpec.name
    ? `/editor/${encodeURIComponent(componentSpec.name)}`
    : "";

  const canAccessEditorSpec = useCheckComponentSpecFromPath(
    editorRoute,
    !componentSpec.name,
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

  const isViewingSubgraph = currentSubgraphPath.length > 1;

  return (
    <InlineStack
      gap="2"
      className={cn(
        "fixed left-0 p-2 z-50 bg-background border rounded-br-lg",
        isViewingSubgraph ? "top-23" : "top-14",
      )}
    >
      <ViewYamlButton componentSpec={componentSpec} displayLabel="View" />

      {canAccessEditorSpec && componentSpec.name && (
        <InspectPipelineButton pipelineName={componentSpec.name} showLabel />
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
  );
};
