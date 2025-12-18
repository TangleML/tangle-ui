import { CopyText } from "@/components/shared/CopyText/CopyText";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { useCheckComponentSpecFromPath } from "@/hooks/useCheckComponentSpecFromPath";
import { useUserDetails } from "@/hooks/useUserDetails";
import { useBackend } from "@/providers/BackendProvider";
import { useComponentSpec } from "@/providers/ComponentSpecProvider";
import { useExecutionData } from "@/providers/ExecutionDataProvider";
import {
  countTaskStatuses,
  getRunStatus,
  isStatusComplete,
  isStatusInProgress,
} from "@/services/executionService";

import {
  ActionBlock,
  type ActionOrReactNode,
} from "../shared/ContextPanel/Blocks/ActionBlock";
import { ContentBlock } from "../shared/ContextPanel/Blocks/ContentBlock";
import { ListBlock } from "../shared/ContextPanel/Blocks/ListBlock";
import { TextBlock } from "../shared/ContextPanel/Blocks/TextBlock";
import PipelineIO from "../shared/Execution/PipelineIO";
import { InfoBox } from "../shared/InfoBox";
import { LoadingScreen } from "../shared/LoadingScreen";
import { StatusBar, StatusText } from "../shared/Status";
import { TaskImplementation } from "../shared/TaskDetails";
import { CancelPipelineRunButton } from "./components/CancelPipelineRunButton";
import { ClonePipelineButton } from "./components/ClonePipelineButton";
import { InspectPipelineButton } from "./components/InspectPipelineButton";
import { RerunPipelineButton } from "./components/RerunPipelineButton";

export const RunDetails = () => {
  const { configured } = useBackend();
  const { componentSpec } = useComponentSpec();
  const {
    rootDetails: details,
    rootState: state,
    runId,
    metadata,
    isLoading,
    error,
  } = useExecutionData();
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

  if (error || !details || !state || !componentSpec) {
    return (
      <BlockStack fill>
        <InfoBox title="Error" variant="error">
          Pipeline Run could not be loaded.
        </InfoBox>
      </BlockStack>
    );
  }

  if (isLoading) {
    return <LoadingScreen message="Loading run details..." />;
  }

  if (!configured) {
    return (
      <BlockStack fill>
        <InfoBox title="Backend not configured" variant="warning">
          Configure a backend to view execution artifacts.
        </InfoBox>
      </BlockStack>
    );
  }

  const statusCounts = countTaskStatuses(details, state);
  const runStatus = getRunStatus(statusCounts);
  const hasRunningTasks = statusCounts.running > 0;
  const isInProgress = isStatusInProgress(runStatus) || hasRunningTasks;
  const isComplete = isStatusComplete(runStatus);

  const annotations = componentSpec.metadata?.annotations || {};

  const actions: ActionOrReactNode[] = [];

  actions.push(
    <TaskImplementation
      displayName={componentSpec.name ?? "Pipeline"}
      componentSpec={componentSpec}
      showInlineContent={false}
    />,
  );

  if (canAccessEditorSpec && componentSpec.name) {
    actions.push(
      <InspectPipelineButton key="inspect" pipelineName={componentSpec.name} />,
    );
  }

  actions.push(
    <ClonePipelineButton
      key="clone"
      componentSpec={componentSpec}
      runId={runId}
    />,
  );

  if (isInProgress && isRunCreator) {
    actions.push(<CancelPipelineRunButton key="cancel" runId={runId} />);
  }

  if (isComplete) {
    actions.push(
      <RerunPipelineButton key="rerun" componentSpec={componentSpec} />,
    );
  }

  return (
    <BlockStack gap="6" className="p-2 h-full">
      <CopyText className="text-lg font-semibold">
        {componentSpec.name ?? "Unnamed Pipeline"}
      </CopyText>

      <ActionBlock actions={actions} />

      {metadata && (
        <ListBlock
          title="Run Info"
          items={[
            { label: "Run Id", value: metadata.id },
            { label: "Execution Id", value: metadata.root_execution_id },
            { label: "Created by", value: metadata.created_by ?? undefined },
            {
              label: "Created at",
              value: metadata.created_at
                ? new Date(metadata.created_at).toLocaleString()
                : undefined,
            },
          ]}
          marker="none"
        />
      )}

      {componentSpec.description && (
        <TextBlock title="Description" text={componentSpec.description} />
      )}

      <ContentBlock title="Status">
        <InlineStack gap="2" blockAlign="center" className="mb-1">
          <Text size="sm" weight="semibold">
            {runStatus}
          </Text>
          <StatusText statusCounts={statusCounts} />
        </InlineStack>
        <StatusBar statusCounts={statusCounts} />
      </ContentBlock>

      {Object.keys(annotations).length > 0 && (
        <ListBlock
          title="Annotations"
          items={Object.entries(annotations).map(([key, value]) => ({
            label: key,
            value: String(value),
          }))}
          marker="none"
        />
      )}

      <PipelineIO readOnly />
    </BlockStack>
  );
};
