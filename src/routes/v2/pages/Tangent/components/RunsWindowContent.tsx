import type { MouseEvent } from "react";

import { InfoBox } from "@/components/shared/InfoBox";
import { Button } from "@/components/ui/button";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { ListItem, type ListItemFlair } from "@/components/ui/list-item";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/typography";
import useToastNotification from "@/hooks/useToastNotification";
import { getDefaultRunPath } from "@/routes/runRoutes";
import { useTangentProject } from "@/routes/v2/pages/Tangent/context/TangentProjectContext";
import { UNNAMED_PIPELINE } from "@/services/projects/placeholderNames";
import { idIdentity } from "@/services/projects/resourceTarget";
import type { ProjectRun } from "@/services/projects/types";
import {
  useProjectRuns,
  useRunExecutionStats,
} from "@/services/projects/useProjectRuns";
import { hasNewTabModifier } from "@/utils/dom";
import {
  getExecutionStatusLabel,
  getOverallExecutionStatusFromStats,
  isInProgressStatus,
} from "@/utils/executionStatus";
import { getErrorMessage } from "@/utils/string";
import { tracking } from "@/utils/tracking";

const FAILED_STATUSES = new Set([
  "FAILED",
  "UPSTREAM_FAILED",
  "UPSTREAM_FAILED_OR_SKIPPED",
  "SYSTEM_ERROR",
  "INVALID",
]);

function runStatusFlair(
  status: string | undefined,
  label: string,
): ListItemFlair {
  if (status === "SUCCEEDED") return { kind: "dot", label, tone: "success" };
  if (status && FAILED_STATUSES.has(status)) {
    return { kind: "dot", label, tone: "critical" };
  }
  if (isInProgressStatus(status)) {
    return { kind: "dot", label, tone: "success", pulse: true };
  }
  return { kind: "dot", label };
}

function RunListItem({
  run,
  onOpen,
}: {
  run: ProjectRun;
  onOpen: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  const { data, isPending, error } = useRunExecutionStats(run.id);
  const status = error
    ? undefined
    : getOverallExecutionStatusFromStats(data ?? undefined);
  const label = getExecutionStatusLabel(status);

  return (
    <ListItem
      icon="Play"
      title={run.pipelineName ?? UNNAMED_PIPELINE}
      subtitle={isPending ? undefined : label}
      flair={isPending ? undefined : runStatusFlair(status, label)}
      testId={`open-run-${run.id}`}
      onOpen={onOpen}
      tracking={tracking("projects.project_runs.open_run")}
    />
  );
}

export function RunsWindowContent() {
  const store = useTangentProject();
  const notify = useToastNotification();
  const {
    data,
    isPending,
    error,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useProjectRuns(store.projectId);

  async function handleOpenRun(run: ProjectRun, event: MouseEvent) {
    if (hasNewTabModifier(event)) {
      window.open(getDefaultRunPath(run.id), "_blank");
      return;
    }
    const title = run.pipelineName ?? UNNAMED_PIPELINE;
    try {
      await store.openWorkareaTarget(
        { type: "run", identity: idIdentity(run.id) },
        title,
      );
    } catch (openError) {
      notify(getErrorMessage(openError), "error");
    }
  }

  const runs = data ?? [];

  return (
    <BlockStack gap="4" className="p-2">
      {isPending && (
        <InlineStack gap="2" blockAlign="center">
          <Spinner /> Loading...
        </InlineStack>
      )}

      {error && (
        <InfoBox title="Error loading runs" variant="error">
          {error.message}
        </InfoBox>
      )}

      {data && runs.length === 0 && (
        <Text size="sm" tone="subdued">
          Nothing in this project has been run yet
        </Text>
      )}

      {runs.length > 0 && (
        <BlockStack as="ul" gap="1">
          {runs.map((run) => (
            <RunListItem
              key={run.id}
              run={run}
              onOpen={(event) => void handleOpenRun(run, event)}
            />
          ))}
        </BlockStack>
      )}

      {hasNextPage && (
        <Button
          variant="outline"
          size="sm"
          disabled={isFetchingNextPage}
          onClick={() => void fetchNextPage()}
          {...tracking("projects.project_runs.load_more")}
        >
          {isFetchingNextPage ? "Loading..." : "Load more runs"}
        </Button>
      )}
    </BlockStack>
  );
}
