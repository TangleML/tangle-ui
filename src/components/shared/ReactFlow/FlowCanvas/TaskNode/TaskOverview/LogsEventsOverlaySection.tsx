import type { ContainerExecutionStatus } from "@/api/types.gen";
import { Composer } from "@/components/shared/Composer/Composer";
import overlaySchema from "@/config/logsEventsOverlaySchema.json";
import { useBackend } from "@/providers/BackendProvider";
import {
  filterAndHydrateSchema,
  loadSchema,
} from "@/services/composer/hydrateSchema";
import { useFetchContainerExecutionState } from "@/services/executionService";
import type { BlockHydrationReplacements } from "@/types/composerSchema";

import {
  extractJobName,
  extractPodName,
  resolveJobEventsHydrationReplacements,
  resolvePodLogsHydrationReplacements,
  resolveRetentionNoticeHydrationReplacements,
  resolveRunningHintHydrationReplacements,
} from "./logsEventsResolvers";

const schema = loadSchema(overlaySchema);

interface LogsEventsOverlayProps {
  executionId?: string;
  status?: ContainerExecutionStatus;
}

export const LogsEventsOverlaySection = ({
  executionId,
  status,
}: LogsEventsOverlayProps) => {
  const { backendUrl } = useBackend();
  const { data: containerState } = useFetchContainerExecutionState(
    executionId,
    backendUrl,
  );

  if (schema.sections.length === 0) return null;

  const podName = extractPodName(containerState);
  const jobName = extractJobName(containerState);
  const identifier = podName ?? jobName;
  if (!identifier || !containerState?.started_at) return null;

  const executionType = jobName ? "kubernetes_job" : "kubernetes_pod";
  const { metadata } = schema;

  const allReplacements: Record<string, BlockHydrationReplacements> = {
    retentionNotice: resolveRetentionNoticeHydrationReplacements(
      metadata,
      containerState,
    ),
    runningHint: resolveRunningHintHydrationReplacements(status),
    podLogs: resolvePodLogsHydrationReplacements(
      metadata,
      containerState,
      identifier,
    ),
    podEvents: resolvePodLogsHydrationReplacements(
      metadata,
      containerState,
      identifier,
    ),
    jobEvents: resolveJobEventsHydrationReplacements(
      metadata,
      containerState,
      identifier,
    ),
  };

  const hydrated = filterAndHydrateSchema(
    schema,
    allReplacements,
    executionType,
  );
  return <Composer schema={hydrated} />;
};
