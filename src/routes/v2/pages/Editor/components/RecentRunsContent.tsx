import { Link } from "@tanstack/react-router";
import { observer } from "mobx-react-lite";

import { PipelineRunsList } from "@/components/shared/PipelineRunDisplay/PipelineRunsList";
import StatusIcon from "@/components/shared/Status/StatusIcon";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Text } from "@/components/ui/typography";
import { usePipelineRunList } from "@/hooks/usePipelineRunList";
import { useBackend } from "@/providers/BackendProvider";
import { getDefaultRunPath } from "@/routes/runRoutes";
import { useEditorSession } from "@/routes/v2/pages/Editor/store/EditorSessionContext";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";
import { parseRemotePipelineReference } from "@/services/pipelineStorage/remotePipelineRecovery";
import { formatDate } from "@/utils/date";
import { getOverallExecutionStatusFromStats } from "@/utils/executionStatus";
import { filtersToFilterQuery } from "@/utils/pipelineRunFilterUtils";
import { isPipelineId } from "@/utils/pipelineRunSource";

const NO_RUNS_MESSAGE = "No runs yet. Submit this pipeline to see runs here.";

export const RecentRunsContent = observer(function RecentRunsContent() {
  const { navigation } = useSharedStores();
  const { pipelineFile } = useEditorSession();
  const { backendUrl } = useBackend();
  const file = pipelineFile.activePipelineFile;

  if (file?.storageKind === "remote") {
    const source = parseRemotePipelineReference(file.referenceId);
    if (
      !source ||
      !isPipelineId(source.pipelineId) ||
      source.backendUrl !== backendUrl.replace(/\/+$/, "")
    ) {
      return (
        <EmptyState
          size="sm"
          description="Run history is unavailable for this pipeline on the current backend."
        />
      );
    }
    return <RemoteRecentRuns pipelineId={source.pipelineId} />;
  }

  return (
    <BlockStack className="p-2 [&_.text-sm]:text-xs!">
      <PipelineRunsList
        pipelineName={navigation.rootSpec?.name}
        showTitle={false}
        defaultShowingRuns={10}
        showMoreButton={false}
        emptyState={<EmptyState size="sm" description={NO_RUNS_MESSAGE} />}
        overviewConfig={{
          showName: false,
          showDescription: true,
          showTaskStatusBar: false,
        }}
      />
    </BlockStack>
  );
});

function RemoteRecentRuns({ pipelineId }: { pipelineId: string }) {
  const { configured, available } = useBackend();
  const filters = { saved_pipeline_id: pipelineId };
  const { data, isPending, error, refetch } = usePipelineRunList({
    filterQuery: filtersToFilterQuery(filters),
  });

  if (!configured || !available) {
    return (
      <EmptyState
        size="sm"
        description="Connect to the backend to view runs."
      />
    );
  }
  if (error) {
    return (
      <EmptyState
        size="sm"
        title="Could not load runs"
        description={error.message}
      >
        <Button size="xs" variant="outline" onClick={() => void refetch()}>
          Retry
        </Button>
      </EmptyState>
    );
  }
  if (isPending) {
    return <EmptyState size="sm" description="Loading runs…" />;
  }
  if (!data?.pipeline_runs.length) {
    return <EmptyState size="sm" description={NO_RUNS_MESSAGE} />;
  }

  return (
    <BlockStack gap="1" className="p-2">
      <ScrollArea>
        {data.pipeline_runs.slice(0, 10).map((run) => (
          <Link
            key={run.id}
            to={getDefaultRunPath(run.id)}
            className="block rounded p-2 hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
          >
            <InlineStack gap="2" blockAlign="center">
              <StatusIcon
                status={getOverallExecutionStatusFromStats(
                  run.execution_status_stats ?? undefined,
                )}
                tooltip
              />
              <Text size="xs">#{run.id}</Text>
            </InlineStack>
            {run.created_at && (
              <Text size="xs" tone="subdued">
                {formatDate(run.created_at)}
              </Text>
            )}
          </Link>
        ))}
      </ScrollArea>
      <Button asChild variant="link" size="xs">
        <Link to="/runs" search={{ filter: filters }}>
          View all pipeline runs
        </Link>
      </Button>
    </BlockStack>
  );
}
