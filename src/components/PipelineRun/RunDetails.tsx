import { Frown } from "lucide-react";

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
        <Frown className="w-12 h-12 text-gray-500" />
        <div className="text-gray-500">Error loading run details.</div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner className="mr-2" />
        <p className="text-gray-500">Loading run details...</p>
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
      <CopyText className="text-lg font-semibold" showButton={false}>
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
        <div className="flex flex-col gap-2 text-xs text-secondary-foreground mb-2">
          <div className="flex flex-wrap gap-x-6">
            {metadata.id && (
              <div>
                <span className="font-semibold">Run Id:</span> {metadata.id}
              </div>
            )}
            {metadata.root_execution_id && (
              <div>
                <span className="font-semibold">Execution Id:</span>{" "}
                {metadata.root_execution_id}
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-6">
            {metadata.created_by && (
              <div>
                <span className="font-semibold">Created by:</span>{" "}
                {metadata.created_by}
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-x-6">
            {metadata.created_at && (
              <div>
                <span className="font-semibold">Created at:</span>{" "}
                {new Date(metadata.created_at).toLocaleString()}
              </div>
            )}
          </div>
        </div>
      )}

      {componentSpec.description && (
        <div>
          <h3 className="text-md font-medium mb-1">Description</h3>
          <div className="text-sm text-gray-700 whitespace-pre-line">
            {componentSpec.description}
          </div>
        </div>
      )}

      <BlockStack>
        <InlineStack gap="1" blockAlign="center">
          <Text size="md" weight="semibold">Status: {runStatus}</Text>
          <StatusText statusCounts={statusCounts} />
        </InlineStack>
        <StatusBar statusCounts={statusCounts} />
      </BlockStack>

      {Object.keys(annotations).length > 0 && (
        <div>
          <h3 className="text-md font-medium mb-1">Annotations</h3>
          <ul className="text-xs text-secondary-foreground">
            {Object.entries(annotations).map(([key, value]) => (
              <li key={key}>
                <span className="font-semibold">{key}:</span>{" "}
                <span className="break-all">{String(value)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="w-full">
        <h3 className="text-md font-medium mb-1">Artifacts</h3>
        <div className="flex gap-4 flex-col w-full">
          <div className="w-full">
            <h4 className="text-sm font-semibold mb-1">Inputs</h4>
            {componentSpec.inputs && componentSpec.inputs.length > 0 ? (
              <div className="flex flex-col w-full">
                {componentSpec.inputs.map((input) => (
                  <div
                    className="flex flex-row justify-between even:bg-white odd:bg-gray-100 gap-1 px-2 py-1 rounded-xs items-center w-full"
                    key={input.name}
                  >
                    <div className="text-xs flex-1 truncate">
                      <span className="font-semibold">{input.name}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {typeof input.type === "string" ? input.type : "object"}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground">No inputs</div>
            )}
          </div>
          <div className="w-full">
            <h4 className="text-sm font-semibold mb-1">Outputs</h4>
            {componentSpec.outputs && componentSpec.outputs.length > 0 ? (
              <div className="flex flex-col w-full">
                {componentSpec.outputs.map((output) => (
                  <div
                    className="flex flex-row justify-between even:bg-white odd:bg-gray-100 gap-1 px-2 py-1 rounded-xs items-center w-full"
                    key={output.name}
                  >
                    <div className="text-xs flex-1 truncate">
                      <span className="font-semibold">{output.name}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {typeof output.type === "string" ? output.type : "object"}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground">No outputs</div>
            )}
          </div>
        </div>
      </div>
    </BlockStack>
  );
};
