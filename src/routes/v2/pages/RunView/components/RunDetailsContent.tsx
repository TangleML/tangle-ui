import { observer } from "mobx-react-lite";

import type {
  GetExecutionInfoResponse,
  GetGraphExecutionStateResponse,
  PipelineRunResponse,
} from "@/api/types.gen";
import { RunNotesEditor } from "@/components/PipelineRun/RunNotesEditor";
import { ContentBlock } from "@/components/shared/ContextPanel/Blocks/ContentBlock";
import { KeyValueList } from "@/components/shared/ContextPanel/Blocks/KeyValueList";
import { TextBlock } from "@/components/shared/ContextPanel/Blocks/TextBlock";
import { CopyText } from "@/components/shared/CopyText/CopyText";
import PipelineIO from "@/components/shared/Execution/PipelineIO";
import { InfoBox } from "@/components/shared/InfoBox";
import { LoadingScreen } from "@/components/shared/LoadingScreen";
import { StatusBar } from "@/components/shared/Status";
import { TagList } from "@/components/shared/Tags/TagList";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Paragraph, Text } from "@/components/ui/typography";
import { useUserDetails } from "@/hooks/useUserDetails";
import type { ComponentSpec } from "@/models/componentSpec";
import { useBackend } from "@/providers/BackendProvider";
import { useExecutionData } from "@/providers/ExecutionDataProvider";
import { useSpec } from "@/routes/v2/shared/providers/SpecContext";
import {
  FLEX_NODES_ANNOTATION,
  PIPELINE_NOTES_ANNOTATION,
  PIPELINE_TAGS_ANNOTATION,
} from "@/utils/annotations";
import {
  flattenExecutionStatusStats,
  getExecutionStatusLabel,
  getOverallExecutionStatusFromStats,
} from "@/utils/executionStatus";

const EXCLUDED_ANNOTATIONS = [
  PIPELINE_NOTES_ANNOTATION,
  FLEX_NODES_ANNOTATION,
  PIPELINE_TAGS_ANNOTATION,
];

export const RunDetailsContent = observer(function RunDetailsContent() {
  const { configured } = useBackend();
  const spec = useSpec();
  const { data: currentUserDetails } = useUserDetails();
  const {
    rootDetails: details,
    rootState: state,
    metadata,
    isLoading,
    error,
  } = useExecutionData();

  if (error || !details || !state || !spec) {
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

  return (
    <RunDetailsContentLoaded
      spec={spec}
      details={details}
      state={state}
      metadata={metadata}
      currentUserId={currentUserDetails?.id}
    />
  );
});

interface RunDetailsContentLoadedProps {
  spec: ComponentSpec;
  details: GetExecutionInfoResponse;
  state: GetGraphExecutionStateResponse;
  metadata: PipelineRunResponse | undefined;
  currentUserId: string | undefined;
}

function RunDetailsContentLoaded({
  spec,
  details,
  state,
  metadata,
  currentUserId,
}: RunDetailsContentLoadedProps) {
  const executionStatusStats =
    metadata?.execution_status_stats ??
    flattenExecutionStatusStats(state.child_execution_status_stats);

  const overallStatus =
    getOverallExecutionStatusFromStats(executionStatusStats);
  const statusLabel = getExecutionStatusLabel(overallStatus);

  const specAnnotations = spec.annotations;
  const pipelineNotes = specAnnotations.get(PIPELINE_NOTES_ANNOTATION) as
    | string
    | undefined;

  const tagsRaw = specAnnotations.get(PIPELINE_TAGS_ANNOTATION) as
    | string
    | undefined;
  const tags = tagsRaw
    ? tagsRaw
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
    : [];

  const displayedAnnotations = specAnnotations
    .filter((a) => !EXCLUDED_ANNOTATIONS.includes(a.key))
    .map((a) => ({ label: a.key, value: String(a.value) }));

  return (
    <BlockStack gap="6" className="p-2 h-full">
      <CopyText className="text-lg font-semibold">
        {spec.name ?? "Unnamed Pipeline"}
      </CopyText>

      {metadata && <RunInfoSection metadata={metadata} />}

      {spec.description && (
        <TextBlock title="Description" text={spec.description} />
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

      <NotesSection
        pipelineNotes={pipelineNotes}
        metadata={metadata}
        currentUserId={currentUserId}
      />

      <ContentBlock title="Tags">
        <TagList tags={tags} />
      </ContentBlock>
    </BlockStack>
  );
}

function RunInfoSection({ metadata }: { metadata: PipelineRunResponse }) {
  return (
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
  );
}

interface NotesSectionProps {
  pipelineNotes: string | undefined;
  metadata: PipelineRunResponse | undefined;
  currentUserId: string | undefined;
}

function NotesSection({
  pipelineNotes,
  metadata,
  currentUserId,
}: NotesSectionProps) {
  const isRunCreator =
    !!currentUserId && metadata?.created_by === currentUserId;

  return (
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
  );
}
