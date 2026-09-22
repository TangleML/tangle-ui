import { ProjectRunStatus } from "@/components/Project/ProjectRunStatus";
import { InfoBox } from "@/components/shared/InfoBox";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/typography";
import useToastNotification from "@/hooks/useToastNotification";
import { useTangentProject } from "@/routes/v2/pages/Tangent/context/TangentProjectContext";
import { idIdentity } from "@/services/projects/resourceTarget";
import type { ProjectRun } from "@/services/projects/types";
import { useProjectRuns } from "@/services/projects/useProjectRuns";
import { getErrorMessage } from "@/utils/string";

import { WindowListRow } from "./WindowListRow";

const UNNAMED_PIPELINE = "Unnamed pipeline";

export function RunsWindowContent() {
  const store = useTangentProject();
  const notify = useToastNotification();
  const { data, isPending, error } = useProjectRuns(store.projectId);

  async function handleOpenRun(run: ProjectRun) {
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

  const runs = data?.items ?? [];

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
        <BlockStack className="border rounded-md divide-y overflow-auto hide-scrollbar">
          {runs.map((run) => (
            <WindowListRow
              key={run.id}
              icon="Play"
              title={run.pipelineName ?? UNNAMED_PIPELINE}
              description={<ProjectRunStatus runId={run.id} />}
              testId={`open-run-${run.id}`}
              onOpen={() => void handleOpenRun(run)}
            />
          ))}
        </BlockStack>
      )}

      {data?.nextPageToken && (
        <Text size="sm" tone="subdued">
          {`Showing the ${runs.length} most recent runs.`}
        </Text>
      )}
    </BlockStack>
  );
}
