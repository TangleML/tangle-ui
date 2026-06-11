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
import PipelineIO from "@/components/shared/Execution/PipelineIO";
import { InfoBox } from "@/components/shared/InfoBox";
import { LoadingScreen } from "@/components/shared/LoadingScreen";
import { useFlagValue } from "@/components/shared/Settings/useFlags";
import { TagList } from "@/components/shared/Tags/TagList";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack } from "@/components/ui/layout";
import { Separator } from "@/components/ui/separator";
import { Paragraph } from "@/components/ui/typography";
import { useUserDetails } from "@/hooks/useUserDetails";
import type { ComponentSpec } from "@/models/componentSpec";
import { useBackend } from "@/providers/BackendProvider";
import { useExecutionData } from "@/providers/ExecutionDataProvider";
import { useStartOptimizationChat } from "@/routes/v2/pages/RunView/hooks/useStartOptimizationChat";
import { PipelineDetailsCollapsibleSection } from "@/routes/v2/shared/components/PipelineDetailsCollapsibleSection";
import { useSpec } from "@/routes/v2/shared/providers/SpecContext";
import {
  PIPELINE_NOTES_ANNOTATION,
  PIPELINE_TAGS_ANNOTATION,
  SYSTEM_ANNOTATIONS,
} from "@/utils/annotations";
import {
  flattenExecutionStatusStats,
  getExecutionStatusLabel,
  getOverallExecutionStatusFromStats,
} from "@/utils/executionStatus";

import { RunDetailsHeader } from "./RunDetailsHeader";

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
  const pipelineNotes = specAnnotations.get(PIPELINE_NOTES_ANNOTATION);
  const tags = specAnnotations.get(PIPELINE_TAGS_ANNOTATION);

  const displayedAnnotations = specAnnotations
    .filter((a) => !SYSTEM_ANNOTATIONS.includes(a.key))
    .map((a) => ({ label: a.key, value: String(a.value) }));

  return (
    <BlockStack className="h-full min-h-0 w-full">
      <RunDetailsHeader
        pipelineName={spec.name ?? "Unnamed Pipeline"}
        executionStatusStats={executionStatusStats}
        statusLabel={statusLabel}
      />

      <Separator />

      <BlockStack className="min-h-0 flex-1 overflow-y-auto">
        <PipelineDetailsCollapsibleSection
          title="Run Info"
          icon="Info"
          openDefault
        >
          {metadata ? (
            <RunInfoSection metadata={metadata} />
          ) : (
            <Paragraph tone="subdued" size="xs">
              No run information available.
            </Paragraph>
          )}
        </PipelineDetailsCollapsibleSection>

        <PipelineDetailsCollapsibleSection
          title="Details"
          icon="FileText"
          openDefault={false}
        >
          <BlockStack gap="4">
            <DetailsSection
              description={spec.description}
              tags={tags}
              annotations={displayedAnnotations}
            />
            <NotesSection
              pipelineNotes={pipelineNotes}
              metadata={metadata}
              currentUserId={currentUserId}
            />
          </BlockStack>
        </PipelineDetailsCollapsibleSection>

        <PipelineDetailsCollapsibleSection
          title="Arguments"
          icon="ArrowDownToLine"
          openDefault={false}
        >
          <PipelineIO
            section="inputs"
            taskArguments={details.task_spec.arguments}
          />
        </PipelineDetailsCollapsibleSection>

        <PipelineDetailsCollapsibleSection
          title="Outputs"
          icon="ArrowUpFromLine"
          openDefault={false}
        >
          <PipelineIO
            section="outputs"
            taskArguments={details.task_spec.arguments}
          />
        </PipelineDetailsCollapsibleSection>

        <PipelineDetailsCollapsibleSection
          title="Optimization"
          icon="Sparkles"
          openDefault={true}
        >
          <BlockStack gap="2">
            <Paragraph size="xs" tone="subdued">
              Metrics and optimizations
            </Paragraph>
            <SuggestOptimizationButton />
          </BlockStack>
        </PipelineDetailsCollapsibleSection>
      </BlockStack>
    </BlockStack>
  );
}

function RunInfoSection({ metadata }: { metadata: PipelineRunResponse }) {
  return (
    <KeyValueList
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

interface DetailsSectionProps {
  description: string | undefined;
  tags: string[];
  annotations: { label: string; value: string }[];
}

function DetailsSection({
  description,
  tags,
  annotations,
}: DetailsSectionProps) {
  return (
    <BlockStack gap="4">
      {description && <TextBlock title="Description" text={description} />}

      <ContentBlock title="Tags">
        <TagList tags={tags} />
      </ContentBlock>

      {annotations.length > 0 && (
        <KeyValueList title="Annotations" items={annotations} />
      )}
    </BlockStack>
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
  );
}

function SuggestOptimizationButton() {
  const aiEnabled = useFlagValue("ai-assistant");
  const startOptimizationChat = useStartOptimizationChat();

  if (!aiEnabled) return null;

  return (
    <Button
      variant="secondary"
      onClick={startOptimizationChat}
      className="w-full"
    >
      <Icon name="Sparkles" />
      Suggest optimization
    </Button>
  );
}
