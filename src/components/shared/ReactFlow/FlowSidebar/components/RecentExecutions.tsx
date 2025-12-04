import { useEffect, useMemo } from "react";

import { InfoBox } from "@/components/shared/InfoBox";
import RunOverview from "@/components/shared/RunOverview";
import { Link } from "@/components/ui/link";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { Paragraph } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import { useBackend } from "@/providers/BackendProvider";
import { usePipelineRuns } from "@/providers/PipelineRunsProvider";

const RecentExecutions = ({ pipelineName }: { pipelineName?: string }) => {
  const { backendUrl, configured, available } = useBackend();
  const { runs, recentRuns, isLoading, error, refetch } = usePipelineRuns();

  const runOverviews = useMemo(
    () =>
      recentRuns.map((run) => (
        <Link
          key={run.id}
          href={`/runs/${run.id}`}
          tabIndex={0}
          variant="block"
          className="w-full"
        >
          <RunOverview
            run={run}
            config={{
              showName: false,
            }}
            className="rounded-sm hover:bg-gray-100 w-full"
          />
        </Link>
      )),
    [recentRuns],
  );

  const remainingRuns = runs.length - recentRuns.length;

  useEffect(() => {
    refetch();
  }, [backendUrl, refetch]);

  const titleMarkup = (
    <h3 className={cn("text-md mb-1", { "font-medium": !pipelineName })}>
      {pipelineName ? <span className="font-bold">{pipelineName}</span> : null}
      {pipelineName ? " - " : ""}
      Recent Pipeline Runs
    </h3>
  );

  if (isLoading) {
    return (
      <div>
        {titleMarkup}
        <div className="h-48 rounded p-2 flex items-center justify-center">
          <Spinner className="mr-2" />
          <p className="text-secondary-foreground">
            Loading recent pipeline runs...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        {titleMarkup}
        <div className="h-48 rounded p-2 flex items-center justify-center">
          <p className="text-destructive">{error}</p>
        </div>
      </div>
    );
  }

  if (!configured) {
    return (
      <div>
        {titleMarkup}
        <InfoBox title="Backend not configured" variant="warning">
          Configure a backend to view recent pipeline runs.
        </InfoBox>
      </div>
    );
  }

  if (!available) {
    return (
      <div>
        {titleMarkup}
        <InfoBox title="Backend not available" variant="error">
          The configured backend is unavailable.
        </InfoBox>
      </div>
    );
  }

  return (
    <div>
      {titleMarkup}
      {recentRuns.length === 0 ? (
        <div className="text-xs text-muted-foreground">No runs yet.</div>
      ) : (
        <ScrollArea className="h-fit rounded w-full">
          {runOverviews}
          {remainingRuns > 0 && (
            <Paragraph
              size="xs"
              tone="subdued"
              className="mt-2 w-full text-center"
            >
              +{remainingRuns} more runs
            </Paragraph>
          )}
        </ScrollArea>
      )}
    </div>
  );
};

export default RecentExecutions;
