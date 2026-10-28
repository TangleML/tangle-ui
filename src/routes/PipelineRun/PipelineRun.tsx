import { DndContext } from "@dnd-kit/core";
import { useParams } from "@tanstack/react-router";
import { ReactFlowProvider } from "@xyflow/react";
import { useEffect } from "react";

import PipelineRunPage from "@/components/PipelineRun";
import { InfoBox } from "@/components/shared/InfoBox";
import { LoadingScreen } from "@/components/shared/LoadingScreen";
import { NodesOverlayProvider } from "@/components/shared/ReactFlow/NodesOverlay/NodesOverlayProvider";
import { RemoteAuthErrorView } from "@/components/shared/RemoteAuthErrorView";
import { BlockStack } from "@/components/ui/layout";
import { Paragraph } from "@/components/ui/typography";
import { faviconManager, getFaviconStatus } from "@/favicon";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useTrackRecentlyViewedRun } from "@/hooks/useTrackRecentlyViewedRun";
import { useBackend } from "@/providers/BackendProvider";
import { useComponentSpec } from "@/providers/ComponentSpecProvider";
import {
  ExecutionDataProvider,
  useExecutionData,
} from "@/providers/ExecutionDataProvider";
import { getBackendStatusString } from "@/utils/backend";
import type { ComponentSpec } from "@/utils/componentSpec";
import {
  flattenExecutionStatusStats,
  getOverallExecutionStatusFromStats,
} from "@/utils/executionStatus";
import { RemoteAuthError } from "@/utils/fetchWithErrorHandling";

const PipelineRunContent = () => {
  const { setComponentSpec, clearComponentSpec, componentSpec } =
    useComponentSpec();
  const { configured, available, ready } = useBackend();
  const params = useParams({ strict: false });
  const runId =
    "id" in params && typeof params.id === "string" ? params.id : null;

  const {
    details,
    state,
    isLoading: isLoadingCurrentLevelData,
    error: currentLevelError,
    rootDetails,
  } = useExecutionData();

  const isLoading = isLoadingCurrentLevelData;
  const error = currentLevelError;

  useEffect(() => {
    if (!details || !state) {
      faviconManager.reset();
      return;
    }

    const executionStatusStats = flattenExecutionStatusStats(
      state.child_execution_status_stats,
    );
    const overallStatus =
      getOverallExecutionStatusFromStats(executionStatusStats);
    faviconManager.updateFavicon(getFaviconStatus(overallStatus));

    return () => {
      faviconManager.reset();
    };
  }, [details, state]);

  useEffect(() => {
    if (rootDetails?.task_spec.componentRef.spec) {
      setComponentSpec(
        rootDetails.task_spec.componentRef.spec as ComponentSpec,
      );
    }

    return () => {
      clearComponentSpec();
    };
  }, [rootDetails, setComponentSpec, clearComponentSpec]);

  useDocumentTitle({
    "/runs/$id": (params) =>
      `Tangle - ${componentSpec?.name || ""} - ${params.id}`,
  });

  useTrackRecentlyViewedRun(runId, componentSpec?.name);

  if (isLoading || !ready) {
    return <LoadingScreen message="Loading Pipeline Run" />;
  }

  if (!configured) {
    return (
      <BlockStack fill>
        <InfoBox title="Backend not configured" variant="warning">
          Configure a backend to view this pipeline run.
        </InfoBox>
      </BlockStack>
    );
  }

  if (!available) {
    return (
      <BlockStack fill>
        <InfoBox title="Backend not available" variant="error">
          The configured backend is not available.
        </InfoBox>
      </BlockStack>
    );
  }

  if (error && !rootDetails) {
    if (error instanceof RemoteAuthError) {
      return <RemoteAuthErrorView />;
    }
    const backendStatusString = getBackendStatusString(configured, available);
    return (
      <BlockStack fill>
        <InfoBox title="Error loading pipeline run" variant="error">
          <Paragraph size="sm" className="mb-2">
            {error.message}
          </Paragraph>
          <Paragraph size="sm" className="italic">
            {backendStatusString}
          </Paragraph>
        </InfoBox>
      </BlockStack>
    );
  }

  return <PipelineRunPage />;
};

const PipelineRun = () => {
  const params = useParams({ strict: false });

  if (!("id" in params) || typeof params.id !== "string") {
    throw new Error("Missing required id parameter");
  }

  const id = params.id;
  const subgraphExecutionId =
    "subgraphExecutionId" in params &&
    typeof params.subgraphExecutionId === "string"
      ? params.subgraphExecutionId
      : undefined;

  return (
    <DndContext>
      <ReactFlowProvider>
        <NodesOverlayProvider>
          <ExecutionDataProvider
            pipelineRunId={id}
            subgraphExecutionId={subgraphExecutionId}
          >
            <PipelineRunContent />
          </ExecutionDataProvider>
        </NodesOverlayProvider>
      </ReactFlowProvider>
    </DndContext>
  );
};

export default PipelineRun;
