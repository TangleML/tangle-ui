import type { ComponentProps } from "react";

import { InfoBox } from "@/components/shared/InfoBox";
import { Paragraph } from "@/components/ui/typography";
import { ArtifactFetchError } from "@/services/executionService";
import { getErrorMessage } from "@/utils/string";

import { getArtifactRetentionDays } from "../../artifactRetentionUtils";
import { ParquetUnsupportedCodecError } from "./parquetUtils";

interface ArtifactPreviewErrorProps {
  title: string;
  preamble: string;
  detail?: string;
  variant?: ComponentProps<typeof InfoBox>["variant"];
  withRetentionHint?: boolean;
}

const ArtifactPreviewError = ({
  title,
  preamble,
  detail,
  variant = "error",
  withRetentionHint = false,
}: ArtifactPreviewErrorProps) => {
  const retentionDays = withRetentionHint ? getArtifactRetentionDays() : null;
  const retentionNote =
    retentionDays !== null
      ? ` It may have expired — artifacts are expected to be available for up to ${retentionDays} days.`
      : "";

  return (
    <InfoBox title={title} variant={variant} width="full">
      {preamble}
      {retentionNote}
      {detail && (
        <Paragraph size="xs" tone="subdued" font="mono" className="mt-1">
          {detail}
        </Paragraph>
      )}
    </InfoBox>
  );
};

export const ArtifactPreviewErrorFallback = ({ error }: { error: unknown }) => {
  if (
    error instanceof ArtifactFetchError &&
    error.status === 404 &&
    import.meta.env.VITE_ARTIFACT_RETENTION_DAYS
  ) {
    return (
      <ArtifactPreviewError
        title="Artifact unavailable"
        preamble="This artifact could not be found."
        variant="warning"
        withRetentionHint
      />
    );
  }

  if (error instanceof ArtifactFetchError && error.status === 413) {
    return (
      <ArtifactPreviewError
        title="Too large to preview"
        preamble={error.message}
        variant="warning"
      />
    );
  }

  if (error instanceof ParquetUnsupportedCodecError) {
    return (
      <ArtifactPreviewError
        title="Can't preview this file"
        preamble={error.message}
        variant="warning"
      />
    );
  }

  if (error instanceof ArtifactFetchError) {
    const status = [error.status, error.statusText].filter(Boolean).join(" ");
    return (
      <ArtifactPreviewError
        title="Failed to load artifact"
        preamble={`An unexpected error occurred (${status}).`}
        withRetentionHint
      />
    );
  }

  return (
    <ArtifactPreviewError
      title="Failed to load artifact"
      preamble="An unexpected error occurred."
      detail={getErrorMessage(error)}
    />
  );
};
