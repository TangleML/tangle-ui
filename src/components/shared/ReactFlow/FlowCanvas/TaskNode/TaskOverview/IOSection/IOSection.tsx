import { useQuery } from "@tanstack/react-query";

import { InfoBox } from "@/components/shared/InfoBox";
import { BlockStack } from "@/components/ui/layout";
import { Spinner } from "@/components/ui/spinner";
import { Paragraph } from "@/components/ui/typography";
import { useBackend } from "@/providers/BackendProvider";
import { useExecutionData } from "@/providers/ExecutionDataProvider";
import { getExecutionArtifacts } from "@/services/executionService";
import { getBackendStatusString } from "@/utils/backend";
import type { TaskSpec } from "@/utils/componentSpec";
import { addDays, formatDate, isOlderThanDays } from "@/utils/date";

import { ArtifactRetentionNotice } from "./ArtifactRetentionNotice";
import { getArtifactRetentionDays } from "./artifactRetentionUtils";
import IOExtras from "./IOExtras";
import IOInputs from "./IOInputs";
import IOOutputs from "./IOOutputs";

interface IOSectionProps {
  taskSpec: TaskSpec;
  executionId?: string | number;
  readOnly?: boolean;
}

const IOSection = ({ taskSpec, executionId, readOnly }: IOSectionProps) => {
  const { backendUrl, configured, available } = useBackend();
  const { metadata } = useExecutionData();

  const {
    data: artifacts,
    isLoading,
    isFetching,
    error,
  } = useQuery({
    queryKey: ["artifacts", executionId],
    queryFn: () => getExecutionArtifacts(String(executionId), backendUrl),
    enabled: !!executionId,
  });

  if (!configured) {
    return (
      <InfoBox title="Backend not configured" variant="warning">
        Configure a backend to view execution artifacts.
      </InfoBox>
    );
  }

  if (isLoading || isFetching) {
    return (
      <BlockStack gap="2" align="center">
        <Spinner /> Loading Artifacts...
      </BlockStack>
    );
  }

  if (error) {
    const backendStatusString = getBackendStatusString(configured, available);

    return (
      <InfoBox title="Error loading artifacts" variant="error">
        <Paragraph className="mb-2">{error.message}</Paragraph>
        <Paragraph className="text-black italic">
          {backendStatusString}
        </Paragraph>
      </InfoBox>
    );
  }

  if (!artifacts) {
    return (
      <InfoBox title="No artifacts" variant="error">
        No artifacts found for this execution.
      </InfoBox>
    );
  }

  const order = readOnly
    ? ["inputs", "outputs", "other"]
    : ["outputs", "inputs", "other"];

  const retentionDays = getArtifactRetentionDays();

  const isOlderThanRetentionPeriod =
    retentionDays !== null &&
    metadata?.created_at &&
    isOlderThanDays(metadata.created_at, retentionDays);

  const expiryDate =
    retentionDays !== null &&
    metadata?.created_at &&
    !isOlderThanRetentionPeriod
      ? formatDate(addDays(metadata.created_at, retentionDays), {
          month: "long",
          day: "numeric",
          year: "numeric",
        })
      : null;

  return (
    <BlockStack gap="4" className="w-full">
      {isOlderThanRetentionPeriod ? (
        <ArtifactRetentionNotice title="Artifact Storage" />
      ) : expiryDate ? (
        <InfoBox title="Artifact Storage" variant="info" width="full">
          Artifacts from this run expire on {expiryDate}.
        </InfoBox>
      ) : null}
      {order.map((section) => {
        if (section === "inputs") {
          return (
            <IOInputs
              key="inputs"
              inputs={taskSpec.componentRef.spec?.inputs}
              artifacts={artifacts}
            />
          );
        }

        if (section === "outputs") {
          return (
            <IOOutputs
              key="outputs"
              outputs={taskSpec.componentRef.spec?.outputs}
              artifacts={artifacts}
            />
          );
        }

        if (section === "other") {
          return (
            <IOExtras
              key="other"
              inputs={taskSpec.componentRef.spec?.inputs}
              outputs={taskSpec.componentRef.spec?.outputs}
              artifacts={artifacts}
            />
          );
        }

        return null;
      })}
    </BlockStack>
  );
};

export default IOSection;
