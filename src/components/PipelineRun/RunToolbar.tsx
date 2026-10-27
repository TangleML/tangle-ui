import { FavoriteToggle } from "@/components/shared/FavoriteToggle";
import { InlineStack } from "@/components/ui/layout";
import { useCheckComponentSpecFromPath } from "@/hooks/useCheckComponentSpecFromPath";
import { useUserDetails } from "@/hooks/useUserDetails";
import { cn } from "@/lib/utils";
import { useComponentSpec } from "@/providers/ComponentSpecProvider";
import { useExecutionData } from "@/providers/ExecutionDataProvider";
import {
  getDefaultEditorPath,
  getDefaultRemoteEditorPath,
} from "@/routes/editorRoutes";
import { extractCanonicalName } from "@/utils/canonicalPipelineName";
import {
  countInProgressFromStats,
  flattenExecutionStatusStats,
  isExecutionComplete,
} from "@/utils/executionStatus";
import { remotePipelineIdFromRunAnnotations } from "@/utils/remotePipelineRunAnnotations";

import { ViewYamlButton } from "../shared/Buttons/ViewYamlButton";
import { buildTaskSpecShape } from "../shared/PipelineRunNameTemplate/types";
import { CancelPipelineRunButton } from "./components/CancelPipelineRunButton";
import { ClonePipelineButton } from "./components/ClonePipelineButton";
import { InspectPipelineButton } from "./components/InspectPipelineButton";
import { RerunPipelineButton } from "./components/RerunPipelineButton";

export const RunToolbar = () => {
  const { componentSpec, currentSubgraphPath } = useComponentSpec();
  const {
    rootState: state,
    runId,
    metadata,
    rootDetails: details,
  } = useExecutionData();
  const { data: currentUserDetails } = useUserDetails();

  const remotePipelineId = remotePipelineIdFromRunAnnotations(
    metadata?.annotations,
  );

  const editorRoute = componentSpec.name
    ? getDefaultEditorPath(componentSpec.name)
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

  const isViewingSubgraph = currentSubgraphPath.length > 1;

  const pipelineName =
    extractCanonicalName(
      buildTaskSpecShape(details?.task_spec, componentSpec),
    ) ?? componentSpec.name;

  const inspectPath = remotePipelineId
    ? getDefaultRemoteEditorPath(remotePipelineId)
    : pipelineName
      ? getDefaultEditorPath(pipelineName)
      : undefined;

  return (
    <InlineStack
      gap="2"
      className={cn(
        "fixed left-0 p-2 z-50 bg-background border rounded-br-lg",
        isViewingSubgraph ? "top-23" : "top-14",
      )}
    >
      {runId && pipelineName && (
        <FavoriteToggle type="run" id={runId} name={pipelineName} />
      )}
      <ViewYamlButton componentSpec={componentSpec} displayLabel="View" />

      {(remotePipelineId || canAccessEditorSpec) && inspectPath && (
        <InspectPipelineButton
          pipelineName={pipelineName}
          inspectPath={inspectPath}
          showLabel
        />
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
        <RerunPipelineButton
          componentSpec={componentSpec}
          runId={runId}
          showLabel
        />
      )}
    </InlineStack>
  );
};
