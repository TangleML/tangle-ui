import type { ContainerExecutionStatus } from "@/api/types.gen";
import { Composer } from "@/components/shared/Composer/Composer";
import overlaySchema from "@/config/logsEventsOverlaySchema.json";
import { useBackend } from "@/providers/BackendProvider";
import { hydrateSchema, loadSchema } from "@/services/composer/hydrateSchema";
import { useFetchContainerExecutionState } from "@/services/executionService";
import type { BlockHydrationReplacements } from "@/types/composerSchema";

import {
  extractPodName,
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
  if (!podName || !containerState?.started_at) return null;

  const { metadata } = schema;

  // Key = block ID from the schema. hydrateSchema() matches each block
  // to its replacements by this ID.
  const allReplacements: Record<string, BlockHydrationReplacements> = {
    podLogs: resolvePodLogsHydrationReplacements(
      metadata,
      containerState,
      podName,
    ),
    podEvents: resolvePodLogsHydrationReplacements(
      metadata,
      containerState,
      podName,
    ),
    retentionNotice: resolveRetentionNoticeHydrationReplacements(
      metadata,
      containerState,
    ),
    runningHint: resolveRunningHintHydrationReplacements(status),
  };

  const hydratedComposerSchema = hydrateSchema(schema, allReplacements);
  return <Composer schema={hydratedComposerSchema} />;
};
