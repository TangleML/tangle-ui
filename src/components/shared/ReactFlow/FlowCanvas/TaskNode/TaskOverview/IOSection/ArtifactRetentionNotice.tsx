import { InfoBox } from "@/components/shared/InfoBox";

import { getArtifactRetentionDays } from "./artifactRetentionUtils";

interface ArtifactRetentionNoticeProps {
  title: string;
}

/**
 * Section-level banner shown when artifacts from a pipeline run may have expired.
 * Only renders retention context when VITE_ARTIFACT_RETENTION_DAYS is configured.
 */
export const ArtifactRetentionNotice = ({
  title,
}: ArtifactRetentionNoticeProps) => {
  const retentionDays = getArtifactRetentionDays();
  const note =
    retentionDays !== null
      ? `Artifacts are expected to expire after ${retentionDays} days and may no longer be available in remote storage.`
      : "";

  return (
    <InfoBox title={title} variant="warning" width="full">
      {note}
    </InfoBox>
  );
};
