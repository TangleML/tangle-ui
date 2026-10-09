import type { MouseEvent } from "react";

import { ProjectRunStatus } from "@/components/Project/ProjectRunStatus";
import { InfoBox } from "@/components/shared/InfoBox";
import { Button } from "@/components/ui/button";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/typography";
import useToastNotification from "@/hooks/useToastNotification";
import { useTangentProject } from "@/routes/v2/pages/Tangent/context/TangentProjectContext";
import {
  openRunPageInNewTab,
  requestsNewTab,
} from "@/routes/v2/pages/Tangent/services/openRunPageInNewTab";
import { UNNAMED_PIPELINE } from "@/services/projects/placeholderNames";
import { idIdentity } from "@/services/projects/resourceTarget";
import type { ProjectRun } from "@/services/projects/types";
import { useProjectRuns } from "@/services/projects/useProjectRuns";
import { getErrorMessage } from "@/utils/string";
import { tracking } from "@/utils/tracking";

import { WindowListRow } from "./WindowListRow";

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
    if (requestsNewTab(event)) {
      openRunPageInNewTab(run.id);
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
        <BlockStack className="border rounded-md divide-y">
          {runs.map((run) => (
            <WindowListRow
              key={run.id}
              icon="Play"
              title={run.pipelineName ?? UNNAMED_PIPELINE}
              description={<ProjectRunStatus runId={run.id} />}
              testId={`open-run-${run.id}`}
              onOpen={(event) => void handleOpenRun(run, event)}
              {...tracking("projects.project_runs.open_run")}
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
