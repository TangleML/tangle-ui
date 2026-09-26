import { useQuery } from "@tanstack/react-query";
import { observer } from "mobx-react-lite";

import type {
  GetExecutionInfoResponse,
  GetGraphExecutionStateResponse,
  PipelineRunResponse,
} from "@/api/types.gen";
import { RunNotesEditor } from "@/components/PipelineRun/RunNotesEditor";
import { ProjectDetailsSection } from "@/components/Project/ProjectDetailsSection";
import { ContentBlock } from "@/components/shared/ContextPanel/Blocks/ContentBlock";
import { KeyValueList } from "@/components/shared/ContextPanel/Blocks/KeyValueList";
import { TextBlock } from "@/components/shared/ContextPanel/Blocks/TextBlock";
import PipelineIO from "@/components/shared/Execution/PipelineIO";
import { InfoBox } from "@/components/shared/InfoBox";
import { LoadingScreen } from "@/components/shared/LoadingScreen";
import {
  getRunSourceBucket,
  getRunSourceMessage,
  RunSourceIcon,
} from "@/components/shared/RunSource";
import { useFlagValue } from "@/components/shared/Settings/useFlags";
import { TagList } from "@/components/shared/Tags/TagList";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Separator } from "@/components/ui/separator";
import { Paragraph, Text } from "@/components/ui/typography";
import { useAiProviderSettings } from "@/hooks/useAiProviderSettings";
import { useUserDetails } from "@/hooks/useUserDetails";
import type { ComponentSpec } from "@/models/componentSpec";
import { useBackend } from "@/providers/BackendProvider";
import { useExecutionData } from "@/providers/ExecutionDataProvider";
import { useDebugInTangent } from "@/routes/v2/pages/RunView/hooks/useDebugInTangent";
import { TANGENT_AI_REQUIRED } from "@/routes/v2/shared/components/AiChat/components/aiSetupCopy";
import { PipelineDetailsCollapsibleSection } from "@/routes/v2/shared/components/PipelineDetailsCollapsibleSection";
import { useSpec } from "@/routes/v2/shared/providers/SpecContext";
import { useProjectsById } from "@/services/projects/useProjects";
import { runAnnotationsQueryOptions } from "@/services/runAnnotations";
import {
  getAnnotationValue,
  PIPELINE_NOTES_ANNOTATION,
  PIPELINE_TAGS_ANNOTATION,
  RUN_SOURCE_ANNOTATION,
  SYSTEM_ANNOTATIONS,
} from "@/utils/annotations";
import {
  flattenExecutionStatusStats,
  getExecutionStatusLabel,
  getOverallExecutionStatusFromStats,
} from "@/utils/executionStatus";
import { projectIdsFromAnnotations } from "@/utils/projectRunAnnotation";
import { tracking } from "@/utils/tracking";

import { RunDetailsHeader } from "./RunDetailsHeader";

const FAILURE_STATUSES = ["FAILED", "SYSTEM_ERROR", "INVALID"];

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

  const tangentShellEnabled = useFlagValue("tangent-shell");
  const isFailedRun = FAILURE_STATUSES.includes(overallStatus ?? "");
  const showDebugInTangent =
    tangentShellEnabled && isFailedRun && !!metadata?.id;

  const specAnnotations = spec.annotations;
  const pipelineNotes = specAnnotations.get(PIPELINE_NOTES_ANNOTATION);
  const tags = specAnnotations.get(PIPELINE_TAGS_ANNOTATION);

  const displayedAnnotations = specAnnotations
    .filter((a) => !SYSTEM_ANNOTATIONS.includes(a.key))
    .map((a) => ({ label: a.key, value: String(a.value) }));

  const projectIds = useRunProjectIds(metadata?.id);

  return (
    <BlockStack className="h-full min-h-0 w-full">
      <RunDetailsHeader
        pipelineName={spec.name ?? "Unnamed Pipeline"}
        executionStatusStats={executionStatusStats}
        statusLabel={statusLabel}
      />

      {showDebugInTangent && metadata?.id && (
        <BlockStack className="shrink-0 px-4 pb-2">
          <DebugInTangentButton
            runId={metadata.id}
            pipelineName={spec.name ?? "Unnamed Pipeline"}
          />
        </BlockStack>
      )}

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

        <ProjectDetailsSection projectIds={projectIds} />

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
      </BlockStack>
    </BlockStack>
  );
}

/** Attribution is written when the run is created and cannot be revised. */
function useRunProjectIds(runId: string | undefined) {
  const { backendUrl } = useBackend();
  const projectsEnabled = useFlagValue("projects");

  const { data: runAnnotations } = useQuery({
    ...runAnnotationsQueryOptions(runId, backendUrl),
  });

  return projectsEnabled ? projectIdsFromAnnotations(runAnnotations) : [];
}

interface DebugInTangentButtonProps {
  runId: string;
  pipelineName: string;
}

function DebugInTangentButton({
  runId,
  pipelineName,
}: DebugInTangentButtonProps) {
  const { debug, isPending } = useDebugInTangent();
  const { isConfigured: isAiConfigured } = useAiProviderSettings();
  // Only the projects still there: one that has been deleted since is not a
  // place anything can be debugged, and picking it would just make a project.
  const projects = useProjectsById(useRunProjectIds(runId));

  const label = isPending ? "Starting…" : "Debug in Tangent";
  const button = (
    <Button
      variant="outline"
      size="sm"
      className="w-full"
      disabled={isPending || !isAiConfigured}
      title={isAiConfigured ? undefined : TANGENT_AI_REQUIRED}
      onClick={
        projects.length > 1 ? undefined : () => debug({ runId, pipelineName })
      }
      {...tracking("v2.run_view.debug_in_tangent")}
    >
      <Icon name="Bug" size="sm" />
      {label}
    </Button>
  );

  // Attribution is written once and never revised, so a run in two projects
  // cannot be asked which one it meant — only the reader can say.
  if (projects.length <= 1) {
    return button;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{button}</DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-w-72 min-w-56">
        <DropdownMenuLabel>Debug in which project?</DropdownMenuLabel>
        {projects.map((project) => (
          <DropdownMenuItem
            key={project.id}
            onSelect={() =>
              debug({ runId, pipelineName, projectId: project.id })
            }
          >
            <Icon name="Folder" size="sm" />
            <span className="truncate">{project.name}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function RunInfoSection({ metadata }: { metadata: PipelineRunResponse }) {
  const { backendUrl } = useBackend();
  const runId = metadata.id;

  const { data: runAnnotations } = useQuery({
    ...runAnnotationsQueryOptions(runId, backendUrl),
  });

  const runSource = getAnnotationValue(runAnnotations, RUN_SOURCE_ANNOTATION);
  const hasKnownSource = getRunSourceBucket(runSource) !== "unknown";

  return (
    <BlockStack gap="2">
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

      {hasKnownSource && (
        <InlineStack gap="1" blockAlign="center" wrap="nowrap">
          <RunSourceIcon source={runSource} size="xs" />
          <Text size="xs" tone="subdued">
            {getRunSourceMessage(runSource)}
          </Text>
        </InlineStack>
      )}
    </BlockStack>
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
