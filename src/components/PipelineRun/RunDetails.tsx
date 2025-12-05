import { Frown } from "lucide-react";

import { ArtifactsList } from "@/components/shared/ArtifactsList/ArtifactsList";
import { CopyText } from "@/components/shared/CopyText/CopyText";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Spinner } from "@/components/ui/spinner";
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

import { InfoBox } from "../shared/InfoBox";
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
      <div className="flex flex-col gap-8 items-center justify-center h-full">
        <Frown className="w-12 h-12 text-secondary-foreground" />
        <div className="text-secondary-foreground">
          Error loading run details.
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner className="mr-2" />
        <p className="text-secondary-foreground">Loading run details...</p>
      </div>
    );
  }

  if (!configured) {
    return (
      <InfoBox title="Backend not configured" variant="warning">
        Configure a backend to view execution artifacts.
      </InfoBox>
    );
  }

  const statusCounts = countTaskStatuses(details, state);
  const runStatus = getRunStatus(statusCounts);
  const hasRunningTasks = statusCounts.running > 0;
  const isInProgress = isStatusInProgress(runStatus) || hasRunningTasks;
  const isComplete = isStatusComplete(runStatus);

  const annotations = componentSpec.metadata?.annotations || {};

  return (
    <BlockStack gap="6" className="p-2 h-full">
      <CopyText className="text-lg font-semibold">
        {componentSpec.name ?? "Unnamed Pipeline"}
      </CopyText>

      <InlineStack gap="2">
        <TaskImplementation
          displayName={componentSpec.name ?? "Pipeline"}
          componentSpec={componentSpec}
          showInlineContent={false}
        />
        {canAccessEditorSpec && componentSpec.name && (
          <InspectPipelineButton pipelineName={componentSpec.name} />
        )}
        <ClonePipelineButton componentSpec={componentSpec} />
        {isInProgress && isRunCreator && (
          <CancelPipelineRunButton runId={runId} />
        )}
        {isComplete && <RerunPipelineButton componentSpec={componentSpec} />}
      </InlineStack>

      {metadata && (
        <BlockStack>
          <Text as="h3" size="md" weight="semibold" className="mb-1">
            Run Info
          </Text>
          <dl className="flex flex-col gap-1 text-xs text-secondary-foreground">
            {metadata.id && (
              <InlineStack as="div" gap="1" blockAlign="center">
                <Text as="dt" weight="semibold" className="shrink-0">
                  Run Id:
                </Text>
                <dd>
                  <CopyText className="font-mono truncate max-w-[180px]">
                    {metadata.id}
                  </CopyText>
                </dd>
              </InlineStack>
            )}
            {metadata.root_execution_id && (
              <InlineStack as="div" gap="1" blockAlign="center">
                <Text as="dt" weight="semibold" className="shrink-0">
                  Execution Id:
                </Text>
                <dd>
                  <CopyText className="font-mono truncate max-w-[180px]">
                    {metadata.root_execution_id}
                  </CopyText>
                </dd>
              </InlineStack>
            )}
            {metadata.created_by && (
              <InlineStack as="div" gap="1" blockAlign="center">
                <Text as="dt" weight="semibold">
                  Created by:
                </Text>
                <dd>{metadata.created_by}</dd>
              </InlineStack>
            )}
            {metadata.created_at && (
              <InlineStack as="div" gap="1" blockAlign="center">
                <Text as="dt" weight="semibold">
                  Created at:
                </Text>
                <dd>{new Date(metadata.created_at).toLocaleString()}</dd>
              </InlineStack>
            )}
          </dl>
        </BlockStack>
      )}

      {componentSpec.description && (
        <BlockStack>
          <Text as="h3" size="md" weight="semibold" className="mb-1">
            Description
          </Text>
          <Text as="p" size="sm" className="whitespace-pre-line">
            {componentSpec.description}
          </Text>
        </BlockStack>
      )}

      <BlockStack>
        <Text as="h3" size="md" weight="semibold" className="mb-1">
          Status
        </Text>
        <InlineStack gap="2" blockAlign="center" className="mb-1">
          <Text size="sm" weight="semibold">
            {runStatus}
          </Text>
          <StatusText statusCounts={statusCounts} />
        </InlineStack>
        <StatusBar statusCounts={statusCounts} />
      </BlockStack>

      {Object.keys(annotations).length > 0 && (
        <BlockStack>
          <Text as="h3" size="md" weight="semibold" className="mb-1">
            Annotations
          </Text>
          <ul className="text-xs text-secondary-foreground">
            {Object.entries(annotations).map(([key, value]) => (
              <li key={key}>
                <Text as="span" weight="semibold">
                  {key}:
                </Text>{" "}
                <Text as="span" className="break-all">
                  {String(value)}
                </Text>
              </li>
            ))}
          </ul>
        </BlockStack>
      )}

      <ArtifactsList
        inputs={(componentSpec.inputs ?? []).map((input) => ({
          name: input.name,
          type: typeof input.type === "string" ? input.type : "object",
          value: input.value ?? input.default,
        }))}
        outputs={(componentSpec.outputs ?? []).map((output) => ({
          name: output.name,
          type: typeof output.type === "string" ? output.type : "object",
        }))}
      />
    </BlockStack>
  );
};
