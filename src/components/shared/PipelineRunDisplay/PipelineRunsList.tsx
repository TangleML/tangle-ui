import { type ComponentProps, useState } from "react";

import RunOverview from "@/components/shared/PipelineRunDisplay/RunOverview";
import { withSuspenseWrapper } from "@/components/shared/SuspenseWrapper";
import { Button } from "@/components/ui/button";
import { InlineStack } from "@/components/ui/layout";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { PipelineRun } from "@/types/pipelineRun";

import { RecentRunsTitle } from "./components/RecentRunsTitle";
import { usePipelineRuns } from "./usePipelineRuns";

const DEFAULT_SHOWING_RUNS = 4;

interface PipelineRunsListProps {
  pipelineName?: string;
  showMoreButton?: boolean;
  showTitle?: boolean;
  disabled?: boolean;
  overviewConfig?: ComponentProps<typeof RunOverview>["config"];
  onRunClick?: (run: PipelineRun) => void;
}

export const PipelineRunsList = withSuspenseWrapper(
  ({
    pipelineName,
    showMoreButton = true,
    showTitle = true,
    disabled = false,
    overviewConfig,
    onRunClick,
  }: PipelineRunsListProps) => {
    const { data: pipelineRuns } = usePipelineRuns(pipelineName);

    const [showingRuns, setShowingRuns] = useState(DEFAULT_SHOWING_RUNS);

    if (!pipelineRuns) {
      return <RecentRunsTitle pipelineName={pipelineName} runsCount={0} />;
    }

    return (
      <>
        {showTitle && (
          <RecentRunsTitle
            pipelineName={pipelineName}
            runsCount={pipelineRuns.length}
          />
        )}
        <ScrollArea
          className={cn(disabled && "opacity-50 pointer-events-none")}
        >
          {pipelineRuns.slice(0, showingRuns).map((run) => (
            <RunOverview
              key={run.id}
              run={run}
              config={overviewConfig}
              onClick={onRunClick}
            />
          ))}
          {showMoreButton && pipelineRuns.length > showingRuns && (
            <InlineStack className="w-full" align="center">
              <Button
                variant="link"
                size="xs"
                onClick={() =>
                  setShowingRuns(showingRuns + DEFAULT_SHOWING_RUNS)
                }
              >
                + {pipelineRuns.length - showingRuns} more runs
              </Button>
            </InlineStack>
          )}
        </ScrollArea>
      </>
    );
  },
);
