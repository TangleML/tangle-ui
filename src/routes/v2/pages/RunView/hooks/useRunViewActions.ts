import type {
  GetExecutionInfoResponse,
  GetGraphExecutionStateResponse,
  PipelineRunResponse,
} from "@/api/types.gen";
import { buildTaskSpecShape } from "@/components/shared/PipelineRunNameTemplate/types";
import { useCheckComponentSpecFromPath } from "@/hooks/useCheckComponentSpecFromPath";
import { useUserDetails } from "@/hooks/useUserDetails";
import { useComponentSpec } from "@/providers/ComponentSpecProvider";
import { useExecutionData } from "@/providers/ExecutionDataProvider";
import { getDefaultEditorPath } from "@/routes/editorRoutes";
import { extractCanonicalName } from "@/utils/canonicalPipelineName";
import type { ComponentSpec } from "@/utils/componentSpec";
import {
  countInProgressFromStats,
  flattenExecutionStatusStats,
  isExecutionComplete,
} from "@/utils/executionStatus";
import { resolvePipelineInspectPath } from "@/utils/remotePipelineRunAnnotations";

interface RunViewActionsReady {
  ready: true;
  componentSpec: ComponentSpec;
  runId: string | null | undefined;
  canAccessEditorSpec: boolean;
  inspectPath: string | undefined;
  isRunCreator: boolean | "" | undefined;
  isInProgress: boolean;
  isComplete: boolean;
  pipelineName: string | undefined;
}

interface RunViewActionsNotReady {
  ready: false;
}

type RunViewActions = RunViewActionsReady | RunViewActionsNotReady;

function resolveActions(
  componentSpec: ComponentSpec,
  state: GetGraphExecutionStateResponse,
  runId: string | null | undefined,
  metadata: PipelineRunResponse | undefined,
  details: GetExecutionInfoResponse | undefined,
  currentUserId: string | undefined,
  canAccessLocalEditorSpec: boolean,
): RunViewActionsReady {
  const isRunCreator =
    !!currentUserId && metadata?.created_by === currentUserId;

  const executionStatusStats =
    metadata?.execution_status_stats ??
    flattenExecutionStatusStats(state.child_execution_status_stats);

  const isInProgress = countInProgressFromStats(executionStatusStats) > 0;
  const isComplete = isExecutionComplete(executionStatusStats);

  const pipelineName =
    extractCanonicalName(
      buildTaskSpecShape(details?.task_spec, componentSpec),
    ) ?? componentSpec.name;

  const remoteInspectPath = resolvePipelineInspectPath(
    metadata?.annotations,
    undefined,
  );
  const inspectPath = resolvePipelineInspectPath(
    metadata?.annotations,
    pipelineName,
  );

  return {
    ready: true,
    componentSpec,
    runId,
    canAccessEditorSpec: Boolean(remoteInspectPath) || canAccessLocalEditorSpec,
    inspectPath,
    isRunCreator,
    isInProgress,
    isComplete,
    pipelineName,
  };
}

export function useRunViewActions(): RunViewActions {
  const { componentSpec } = useComponentSpec();
  const {
    rootState: state,
    runId,
    metadata,
    rootDetails: details,
  } = useExecutionData();
  const { data: currentUserDetails } = useUserDetails();
  const editorRoute = componentSpec?.name
    ? getDefaultEditorPath(componentSpec.name)
    : "";

  const canAccessEditorSpec = useCheckComponentSpecFromPath(
    editorRoute,
    componentSpec,
  );

  if (!componentSpec || !state) {
    return { ready: false };
  }

  return resolveActions(
    componentSpec,
    state,
    runId,
    metadata,
    details,
    currentUserDetails?.id,
    canAccessEditorSpec,
  );
}
