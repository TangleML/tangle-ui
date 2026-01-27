import { ContentBlock } from "@/components/shared/ContextPanel/Blocks/ContentBlock";
import { KeyValueList } from "@/components/shared/ContextPanel/Blocks/KeyValueList";
import { TextBlock } from "@/components/shared/ContextPanel/Blocks/TextBlock";
import { CopyText } from "@/components/shared/CopyText/CopyText";
import PipelineIO from "@/components/shared/Execution/PipelineIO";
import { InfoBox } from "@/components/shared/InfoBox";
import { LoadingScreen } from "@/components/shared/LoadingScreen";
import { StatusBar } from "@/components/shared/Status";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Paragraph, Text } from "@/components/ui/typography";
import { useUserDetails } from "@/hooks/useUserDetails";
import { useBackend } from "@/providers/BackendProvider";
import { useComponentSpec } from "@/providers/ComponentSpecProvider";
import { useExecutionData } from "@/providers/ExecutionDataProvider";
import {
  getAnnotationValue,
  PIPELINE_NOTES_ANNOTATION,
} from "@/utils/annotations";
import {
  flattenExecutionStatusStats,
  getExecutionStatusLabel,
  getOverallExecutionStatusFromStats,
} from "@/utils/executionStatus";

import { RunNotesEditor } from "./RunNotesEditor";

const EXCLUDED_ANNOTATIONS = [PIPELINE_NOTES_ANNOTATION];

export const RunDetails = () => {
  const { configured } = useBackend();
  const { componentSpec } = useComponentSpec();
  const { data: currentUserDetails } = useUserDetails();
  const {
    rootDetails: details,
    rootState: state,
    metadata,
    isLoading,
    error,
  } = useExecutionData();

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

  const pipelineAnnotations = componentSpec.metadata?.annotations || {};
  const pipelineNotes = getAnnotationValue(
    pipelineAnnotations,
    PIPELINE_NOTES_ANNOTATION,
  );

  const displayedAnnotations = Object.entries(pipelineAnnotations)
    .filter(([key]) => !EXCLUDED_ANNOTATIONS.includes(key))
    .map(([key, value]) => ({ label: key, value: String(value) }));

  const isRunCreator =
    !!currentUserDetails?.id && metadata?.created_by === currentUserDetails.id;

  return (
    <BlockStack gap="6" className="p-2 h-full">
      <CopyText className="text-lg font-semibold">
        {componentSpec.name ?? "Unnamed Pipeline"}
      </CopyText>

      {metadata && (
        <KeyValueList
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

      {displayedAnnotations.length > 0 && (
        <KeyValueList title="Annotations" items={displayedAnnotations} />
      )}

      <PipelineIO taskArguments={details.task_spec.arguments} />

      <ContentBlock title="Notes">
        <BlockStack gap="2">
          <BlockStack>
            <Paragraph size="xs">Pipeline Notes</Paragraph>
            <Paragraph size="xs" tone="subdued">
              {pipelineNotes || "No notes available for this pipeline."}
            </Paragraph>
          </BlockStack>
          {!!metadata?.id && (
            <BlockStack>
              <Paragraph size="xs">Run Notes</Paragraph>
              <RunNotesEditor runId={metadata.id} readOnly={!isRunCreator} />
            </BlockStack>
          )}
        </BlockStack>
      </ContentBlock>
    </BlockStack>
  );
};
