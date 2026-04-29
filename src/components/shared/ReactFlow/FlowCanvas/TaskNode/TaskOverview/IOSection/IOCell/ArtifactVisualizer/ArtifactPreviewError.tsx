import type { ComponentProps } from "react";

import { InfoBox } from "@/components/shared/InfoBox";

import { getArtifactRetentionDays } from "../../artifactRetentionUtils";

interface ArtifactPreviewErrorProps {
  title: string;
  preamble: string;
  variant?: ComponentProps<typeof InfoBox>["variant"];
}

/**
 * Error state shown inside the artifact preview dialog.
 * Appends a retention hint when VITE_ARTIFACT_RETENTION_DAYS is configured.
 */
export const ArtifactPreviewError = ({
  title,
  preamble,
  variant = "error",
}: ArtifactPreviewErrorProps) => {
  const retentionDays = getArtifactRetentionDays();
  const retentionNote =
    retentionDays !== null
      ? ` It may have expired — artifacts are expected to be available for up to ${retentionDays} days.`
      : "";

  return (
    <InfoBox title={title} variant={variant} width="full">
      {preamble}
      {retentionNote}
    </InfoBox>
  );
};
