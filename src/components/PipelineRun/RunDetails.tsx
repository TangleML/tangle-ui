import { useQuery } from "@tanstack/react-query";

import { ContentBlock } from "@/components/shared/ContextPanel/Blocks/ContentBlock";
import { KeyValueList } from "@/components/shared/ContextPanel/Blocks/KeyValueList";
import { TextBlock } from "@/components/shared/ContextPanel/Blocks/TextBlock";
import { CopyText } from "@/components/shared/CopyText/CopyText";
import PipelineIO from "@/components/shared/Execution/PipelineIO";
import { InfoBox } from "@/components/shared/InfoBox";
import { LoadingScreen } from "@/components/shared/LoadingScreen";
import { RunSourceIcon } from "@/components/shared/RunSource";
import { StatusBar } from "@/components/shared/Status";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Paragraph, Text } from "@/components/ui/typography";
import useToastNotification from "@/hooks/useToastNotification";
import { useUserDetails } from "@/hooks/useUserDetails";
import { useBackend } from "@/providers/BackendProvider";
import { useComponentSpec } from "@/providers/ComponentSpecProvider";
import { useExecutionData } from "@/providers/ExecutionDataProvider";
import { fetchRunAnnotations } from "@/services/pipelineRunService";
import {
  getAnnotationValue,
  getPipelineTagsFromSpec,
  PIPELINE_NOTES_ANNOTATION,
  RUN_SOURCE_ANNOTATION,
  SYSTEM_ANNOTATIONS,
} from "@/utils/annotations";
import { TWENTY_FOUR_HOURS_IN_MS } from "@/utils/constants";
import {
  flattenExecutionStatusStats,
  getExecutionStatusLabel,
  getOverallExecutionStatusFromStats,
} from "@/utils/executionStatus";
import { copyToClipboard } from "@/utils/string";

import { ActionButton } from "../shared/Buttons/ActionButton";
import { TagList } from "../shared/Tags/TagList";
import { RunNotesEditor } from "./RunNotesEditor";

export const RunDetails = () => {
  const { backendUrl, configured } = useBackend();
  const { componentSpec } = useComponentSpec();
  const { data: currentUserDetails } = useUserDetails();
  const {
    rootDetails: details,
    rootState: state,
    metadata,
    isLoading,
    error,
  } = useExecutionData();
  const notify = useToastNotification();

  const runId = metadata?.id;
  const { data: runAnnotations } = useQuery({
    queryKey: ["pipeline-run-annotations", runId],
    queryFn: () => fetchRunAnnotations(runId!, backendUrl),
    enabled: !!runId,
    refetchOnWindowFocus: false,
    staleTime: TWENTY_FOUR_HOURS_IN_MS,
  });
  const runSource = getAnnotationValue(runAnnotations, RUN_SOURCE_ANNOTATION);

  const handleCopyUrl = () => {
    copyToClipboard(window.location.href);
    notify("Run URL copied to clipboard", "success");
  };

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
  const tags = getPipelineTagsFromSpec(componentSpec);

  const displayedAnnotations = Object.entries(pipelineAnnotations)
    .filter(([key]) => !SYSTEM_ANNOTATIONS.includes(key))
    .map(([key, value]) => ({ label: key, value: String(value) }));

  const isRunCreator =
    !!currentUserDetails?.id && metadata?.created_by === currentUserDetails.id;

  return (
    <BlockStack gap="6" className="p-2 h-full">
      <InlineStack
        align="space-between"
        blockAlign="start"
        wrap="nowrap"
        className="w-full"
      >
        <CopyText className="text-lg font-semibold">
          {componentSpec.name ?? "Unnamed Pipeline"}
        </CopyText>
        <ActionButton
          tooltip="Share Run"
          onClick={handleCopyUrl}
          icon="Share2"
          className="scale-80"
        />
      </InlineStack>

      {metadata && (
        <KeyValueList
          title="Run Info"
          titleAction={<RunSourceIcon source={runSource} />}
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
        <TextBlock title="Description" text={componentSpec.description} wrap />
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

      <ContentBlock title="Tags">
        <TagList tags={tags} />
      </ContentBlock>
    </BlockStack>
  );
};
