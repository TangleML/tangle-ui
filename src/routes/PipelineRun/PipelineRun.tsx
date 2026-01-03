import { DndContext } from "@dnd-kit/core";
import { useParams } from "@tanstack/react-router";
import { ReactFlowProvider } from "@xyflow/react";
import { useEffect } from "react";

import PipelineRunPage from "@/components/PipelineRun";
import { InfoBox } from "@/components/shared/InfoBox";
import { LoadingScreen } from "@/components/shared/LoadingScreen";
import { BlockStack } from "@/components/ui/layout";
import { Paragraph } from "@/components/ui/typography";
import { faviconManager } from "@/favicon";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
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
    const iconStatus = mapExecutionStatusToFavicon(overallStatus);
    faviconManager.updateFavicon(iconStatus);

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

  if (!componentSpec) {
    return (
      <BlockStack fill>
        <InfoBox title="Error loading pipeline run" variant="error">
          No pipeline data available.
        </InfoBox>
      </BlockStack>
    );
  }

  if (error) {
    const backendStatusString = getBackendStatusString(configured, available);
    return (
      <BlockStack fill>
        <InfoBox title="Error loading pipeline run" variant="error">
          <Paragraph className="mb-2">{error.message}</Paragraph>
          <Paragraph className="italic">{backendStatusString}</Paragraph>
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
        <ExecutionDataProvider
          pipelineRunId={id}
          subgraphExecutionId={subgraphExecutionId}
        >
          <PipelineRunContent />
        </ExecutionDataProvider>
      </ReactFlowProvider>
    </DndContext>
  );
};

export default PipelineRun;

const mapExecutionStatusToFavicon = (
  status: string | undefined,
): "success" | "failed" | "loading" | "paused" | "default" => {
  switch (status) {
    case "SUCCEEDED":
      return "success";
    case "FAILED":
    case "SYSTEM_ERROR":
    case "INVALID":
      return "failed";
    case "RUNNING":
    case "PENDING":
    case "QUEUED":
    case "WAITING_FOR_UPSTREAM":
    case "CANCELLING":
    case "UNINITIALIZED":
      return "loading";
    case "CANCELLED":
    case "SKIPPED":
      return "paused";
    default:
      return "default";
  }
};
