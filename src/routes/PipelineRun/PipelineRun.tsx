import { DndContext } from "@dnd-kit/core";
import { ReactFlowProvider } from "@xyflow/react";
import { useEffect, useEffectEvent } from "react";

import PipelineRunPage from "@/components/PipelineRun";
import { InfoBox } from "@/components/shared/InfoBox";
import { Spinner } from "@/components/ui/spinner";
import { faviconManager } from "@/favicon";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useBackend } from "@/providers/BackendProvider";
import { useComponentSpec } from "@/providers/ComponentSpecProvider";
import {
  ExecutionDataProvider,
  useExecutionData,
} from "@/providers/ExecutionDataProvider";
import { type RunDetailParams, runDetailRoute } from "@/routes/router";
import {
  countTaskStatuses,
  getRunStatus,
  STATUS,
} from "@/services/executionService";
import { getBackendStatusString } from "@/utils/backend";
import type { ComponentSpec } from "@/utils/componentSpec";

const PipelineRunContent = () => {
  const { setComponentSpec, clearComponentSpec, componentSpec } =
    useComponentSpec();
  const { configured, available, ready } = useBackend();

  const {
    details,
    state,
    isLoading: isLoadingCurrentLevelData,
    error: currentLevelError,
    rootDetails,
  } = useExecutionData();

  const isLoading = isLoadingCurrentLevelData;
  const error = currentLevelError;

  const onLoadSpec = useEffectEvent(() => {
    if (rootDetails?.task_spec.componentRef.spec) {
      setComponentSpec(
        rootDetails.task_spec.componentRef.spec as ComponentSpec,
      );
    }
  });

  const onCleanup = useEffectEvent(() => {
    clearComponentSpec();
  });

  useEffect(() => {
    if (!details || !state) {
      faviconManager.reset();
      return;
    }

    const statusCounts = countTaskStatuses(details, state);
    const pipelineStatus = getRunStatus(statusCounts);
    const iconStatus = mapRunStatusToFavicon(pipelineStatus);
    faviconManager.updateFavicon(iconStatus);

    return () => {
      faviconManager.reset();
    };
  }, [details, state]);

  useEffect(() => {
    onLoadSpec();

    return () => {
      onCleanup();
    };
  }, [rootDetails]);

  useDocumentTitle({
    "/runs/$id": (params) =>
      `Oasis - ${componentSpec?.name || ""} - ${params.id}`,
  });

  if (isLoading || !ready) {
    return (
      <div className="flex items-center justify-center h-full w-full gap-2">
        <Spinner /> Loading Pipeline Run...
      </div>
    );
  }

  if (!configured) {
    return (
      <div className="flex items-center justify-center h-full w-full">
        <InfoBox title="Backend not configured" variant="warning">
          Configure a backend to view this pipeline run.
        </InfoBox>
      </div>
    );
  }

  if (!available) {
    return (
      <div className="flex items-center justify-center h-full w-full">
        <InfoBox title="Backend not available" variant="error">
          The configured backend is not available.
        </InfoBox>
      </div>
    );
  }

  if (!componentSpec) {
    return (
      <div className="flex items-center justify-center h-full w-full">
        <InfoBox title="Error loading pipeline run" variant="error">
          No pipeline data available.
        </InfoBox>
      </div>
    );
  }

  if (error) {
    const backendStatusString = getBackendStatusString(configured, available);
    return (
      <div className="flex items-center justify-center h-full w-full gap-2">
        <InfoBox title="Error loading pipeline run" variant="error">
          <div className="mb-2">{error.message}</div>
          <div className="text-black italic">{backendStatusString}</div>
        </InfoBox>
      </div>
    );
  }

  return <PipelineRunPage />;
};

const PipelineRun = () => {
  const { id } = runDetailRoute.useParams() as RunDetailParams;

  return (
    <div className="dndflow">
      <DndContext>
        <ReactFlowProvider>
          <ExecutionDataProvider pipelineRunId={id}>
            <PipelineRunContent />
          </ExecutionDataProvider>
        </ReactFlowProvider>
      </DndContext>
    </div>
  );
};

export default PipelineRun;

const mapRunStatusToFavicon = (
  runStatus: string,
): "success" | "failed" | "loading" | "paused" | "default" => {
  switch (runStatus) {
    case STATUS.SUCCEEDED:
      return "success";
    case STATUS.FAILED:
      return "failed";
    case STATUS.RUNNING:
      return "loading";
    case STATUS.WAITING:
      return "paused";
    case STATUS.CANCELLED:
      return "paused";
    case STATUS.UNKNOWN:
    default:
      return "default";
  }
};
