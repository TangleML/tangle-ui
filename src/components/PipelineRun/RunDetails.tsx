import { Frown, Videotape } from "lucide-react";
import { useEffect, useState } from "react";

import { Spinner } from "@/components/ui/spinner";
import { useCheckComponentSpecFromPath } from "@/hooks/useCheckComponentSpecFromPath";
import { useUserDetails } from "@/hooks/useUserDetails";
import { useBackend } from "@/providers/BackendProvider";
import { useComponentSpec } from "@/providers/ComponentSpecProvider";
import { useExecutionData } from "@/providers/ExecutionDataProvider";
import {
  isStatusComplete,
  isStatusInProgress,
  processExecutionStatuses,
} from "@/services/executionService";
import { fetchPipelineRunById } from "@/services/pipelineRunService";
import type { PipelineRun } from "@/types/pipelineRun";

import { InfoBox } from "../shared/InfoBox";
import { StatusBar, StatusIcon, StatusText } from "../shared/Status";
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

  const [metadata, setMetadata] = useState<PipelineRun | null>(null);

  const isRunCreator =
    currentUserDetails?.id && metadata?.created_by === currentUserDetails.id;

  useEffect(() => {
    const fetchData = async () => {
      if (!runId) {
        setMetadata(null);
        return;
      }

      const res = await fetchPipelineRunById(runId);

      if (!res) {
        setMetadata(null);
        return;
      }

      setMetadata(res);
    };

    fetchData();
  }, [runId]);

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

  const status = processExecutionStatuses(details, state);
  const statusCounts = status.counts;
  const runStatus = status.run;
  const hasRunningTasks = statusCounts.running > 0;
  const isInProgress = isStatusInProgress(runStatus) || hasRunningTasks;
  const isComplete = isStatusComplete(runStatus);

  const annotations = componentSpec.metadata?.annotations || {};

  return (
    <div className="p-2 flex flex-col gap-6 h-full">
      <div className="flex items-center gap-2 max-w-[90%]">
        <Videotape className="w-6 h-6 text-gray-500" />
        <h2 className="text-lg font-semibold">
          {componentSpec.name ?? "Unnamed Pipeline"}
        </h2>
        <StatusIcon status={runStatus} tooltip />
      </div>

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

      <div>
        <div className="flex gap-2">
          {canAccessEditorSpec && componentSpec.name && (
            <InspectPipelineButton pipelineName={componentSpec.name} />
          )}
          <ClonePipelineButton componentSpec={componentSpec} />
          {isInProgress && isRunCreator && (
            <CancelPipelineRunButton runId={runId} />
          )}
          {isComplete && <RerunPipelineButton componentSpec={componentSpec} />}
        </div>
      </div>

      {componentSpec.description && (
        <div>
          <h3 className="text-md font-medium mb-1">Description</h3>
          <div className="text-sm text-gray-700 whitespace-pre-line">
            {componentSpec.description}
          </div>
        </div>
      )}

      <div>
        <div className="flex gap-2">
          <h3 className="text-md font-medium">Status: {runStatus}</h3>
          <StatusText statusCounts={statusCounts} />
        </div>
        <div className="flex flex-col gap-2">
          <StatusBar statusCounts={statusCounts} />
        </div>
      </div>

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

      <div>
        <h3 className="text-md font-medium mb-1">Artifacts</h3>
        <div className="flex gap-4">
          <div className="flex-1">
            <h4 className="text-sm font-semibold mb-1">Inputs</h4>
            {componentSpec.inputs && componentSpec.inputs.length > 0 ? (
              <ul className="list-disc list-inside text-sm text-secondary-foreground">
                {componentSpec.inputs.map((input) => (
                  <li key={input.name}>
                    <span className="font-semibold">{input.name}</span>
                    {input.type && (
                      <span className="ml-2 text-muted-foreground">
                        (
                        {typeof input.type === "string" ? input.type : "object"}
                        )
                      </span>
                    )}
                    {input.description && (
                      <div className="text-xs text-secondary-foreground ml-4">
                        {input.description}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-xs text-muted-foreground">No inputs</div>
            )}
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-semibold mb-1">Outputs</h4>
            {componentSpec.outputs && componentSpec.outputs.length > 0 ? (
              <ul className="list-disc list-inside text-sm text-secondary-foreground">
                {componentSpec.outputs.map((output) => (
                  <li key={output.name}>
                    <span className="font-semibold">{output.name}</span>
                    {output.type && (
                      <span className="ml-2 text-muted-foreground">
                        (
                        {typeof output.type === "string"
                          ? output.type
                          : "object"}
                        )
                      </span>
                    )}
                    {output.description && (
                      <div className="text-xs text-secondary-foreground ml-4">
                        {output.description}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-xs text-muted-foreground">No outputs</div>
            )}
          </div>
        </div>
      </div>

      {componentSpec && (
        <div className="flex flex-col h-full">
          <div className="font-medium text-md flex items-center gap-1 cursor-pointer">
            Pipeline YAML
          </div>
          <div className="mt-1 h-full min-h-0 flex-1">
            <TaskImplementation
              displayName={componentSpec.name ?? "Pipeline"}
              componentSpec={componentSpec}
            />
          </div>
        </div>
      )}
    </div>
  );
};
