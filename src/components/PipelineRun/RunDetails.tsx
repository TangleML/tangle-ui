import { ActionBlock } from "@/components/shared/ContextPanel/Blocks/ActionBlock";
import { ContentBlock } from "@/components/shared/ContextPanel/Blocks/ContentBlock";
import { ListBlock } from "@/components/shared/ContextPanel/Blocks/ListBlock";
import { TextBlock } from "@/components/shared/ContextPanel/Blocks/TextBlock";
import { CopyText } from "@/components/shared/CopyText/CopyText";
import PipelineIO from "@/components/shared/Execution/PipelineIO";
import { InfoBox } from "@/components/shared/InfoBox";
import { LoadingScreen } from "@/components/shared/LoadingScreen";
import { StatusBar } from "@/components/shared/Status";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { useCheckComponentSpecFromPath } from "@/hooks/useCheckComponentSpecFromPath";
import { useUserDetails } from "@/hooks/useUserDetails";
import { useBackend } from "@/providers/BackendProvider";
import { useComponentSpec } from "@/providers/ComponentSpecProvider";
import { useExecutionData } from "@/providers/ExecutionDataProvider";
import {
  countInProgressFromStats,
  flattenExecutionStatusStats,
  getExecutionStatusLabel,
  getOverallExecutionStatusFromStats,
  isExecutionComplete,
} from "@/utils/executionStatus";

import { ViewYamlButton } from "../shared/Buttons/ViewYamlButton";
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

  const executionStatusStats =
    metadata?.execution_status_stats ??
    flattenExecutionStatusStats(state.child_execution_status_stats);

  const overallStatus =
    getOverallExecutionStatusFromStats(executionStatusStats);
  const statusLabel = getExecutionStatusLabel(overallStatus);

  const isInProgress = countInProgressFromStats(executionStatusStats) > 0;
  const isComplete = isExecutionComplete(executionStatusStats);

  const annotations = componentSpec.metadata?.annotations || {};

  const actions = [];

  actions.push(
    <ClonePipelineButton
      key="clone"
      componentSpec={componentSpec}
      runId={runId}
    />,
  );

  actions.push(
    <ViewYamlButton key="view-pipeline-yaml" componentSpec={componentSpec} />,
  );

  if (canAccessEditorSpec && componentSpec.name) {
    actions.push(
      <InspectPipelineButton key="inspect" pipelineName={componentSpec.name} />,
    );
  }

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
            {statusLabel}
          </Text>
        </InlineStack>
        <StatusBar executionStatusStats={executionStatusStats} />
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

      <PipelineIO taskArguments={details.task_spec.arguments} />
    </BlockStack>
  );
};
