import { useNavigate } from "@tanstack/react-router";

import { buildTaskSpecShape } from "@/components/shared/PipelineRunNameTemplate/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import { useCheckComponentSpecFromPath } from "@/hooks/useCheckComponentSpecFromPath";
import { useUserDetails } from "@/hooks/useUserDetails";
import { useComponentSpec } from "@/providers/ComponentSpecProvider";
import { useExecutionData } from "@/providers/ExecutionDataProvider";
import { MenuTriggerButton } from "@/routes/v2/shared/components/MenuTriggerButton";
import { extractCanonicalName } from "@/utils/canonicalPipelineName";
import {
  countInProgressFromStats,
  flattenExecutionStatusStats,
  isExecutionComplete,
} from "@/utils/executionStatus";

export function RunMenu() {
  const navigate = useNavigate();
  const { componentSpec } = useComponentSpec();
  const {
    rootState: state,
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
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <MenuTriggerButton disabled>Run</MenuTriggerButton>
        </DropdownMenuTrigger>
      </DropdownMenu>
    );
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

  const handleInspect = () => {
    if (pipelineName) {
      navigate({ to: `/editor/${encodeURIComponent(pipelineName)}` });
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <MenuTriggerButton>Run</MenuTriggerButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={2}>
        {canAccessEditorSpec && pipelineName && (
          <DropdownMenuItem onSelect={handleInspect}>
            <Icon name="ExternalLink" size="sm" />
            Inspect Pipeline
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />

        {isInProgress && isRunCreator && (
          <DropdownMenuItem className="text-destructive" disabled>
            <Icon name="CircleX" size="sm" />
            Cancel Run
          </DropdownMenuItem>
        )}

        {isComplete && (
          <DropdownMenuItem disabled>
            <Icon name="RefreshCcw" size="sm" />
            Rerun Pipeline
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
