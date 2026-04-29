/**
 * Returns the configured artifact retention period in days, or null if unset.
 * When null, retention-related UI should be suppressed.
 */
export function getArtifactRetentionDays(): number | null {
  return import.meta.env.VITE_ARTIFACT_RETENTION_DAYS
    ? Number(import.meta.env.VITE_ARTIFACT_RETENTION_DAYS)
    : null;
}
