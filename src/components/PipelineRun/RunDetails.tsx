import { CopyText } from "@/components/shared/CopyText/CopyText";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { useBackend } from "@/providers/BackendProvider";
import { useComponentSpec } from "@/providers/ComponentSpecProvider";
import { useExecutionData } from "@/providers/ExecutionDataProvider";
import { countTaskStatuses, getRunStatus } from "@/services/executionService";
import { componentSpecToText } from "@/utils/yaml";

import { CodeViewer } from "../shared/CodeViewer";
import { ActionBlock } from "../shared/ContextPanel/Blocks/ActionBlock";
import { ContentBlock } from "../shared/ContextPanel/Blocks/ContentBlock";
import { ListBlock } from "../shared/ContextPanel/Blocks/ListBlock";
import { TextBlock } from "../shared/ContextPanel/Blocks/TextBlock";
import PipelineIO from "../shared/Execution/PipelineIO";
import { InfoBox } from "../shared/InfoBox";
import { LoadingScreen } from "../shared/LoadingScreen";
import { StatusBar, StatusText } from "../shared/Status";
import { useRunActions } from "./useRunActions";

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

  const statusCounts = countTaskStatuses(details, state);
  const runStatus = getRunStatus(statusCounts);

  const { actions, isYamlFullscreen, handleCloseYaml } = useRunActions({
    componentSpec,
    runId,
    createdBy: metadata?.created_by,
    statusCounts,
  });

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

  const annotations = componentSpec.metadata?.annotations || {};

  return (
    <>
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
      {isYamlFullscreen && (
        <CodeViewer
          code={componentSpecToText(componentSpec)}
          language="yaml"
          filename={componentSpec.name ?? "pipeline.yaml"}
          isFullscreen={isYamlFullscreen}
          onClose={handleCloseYaml}
        />
      )}
    </>
  );
};
