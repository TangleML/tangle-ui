import { List } from "lucide-react";
import type { ComponentProps } from "react";

import { PipelineRunsList } from "@/components/shared/PipelineRunDisplay/PipelineRunsList";
import { usePipelineRuns } from "@/components/shared/PipelineRunDisplay/usePipelineRuns";
import { withSuspenseWrapper } from "@/components/shared/SuspenseWrapper";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export const RecentExecutionsButton = withSuspenseWrapper(
  ({
    pipelineName,
    overviewConfig,
    trigger,
    ...rest
  }: ComponentProps<typeof PipelineRunsList> & {
    trigger?: React.ReactNode;
  }) => {
    const { data: runs } = usePipelineRuns(pipelineName);
    const defaultTrigger = (
      <Button variant="ghost" size="icon" className="size-7">
        <List className="w-4 h-4" />
      </Button>
    );

    return (
      <TooltipProvider>
        <Popover>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild data-popover-trigger>
                {trigger ?? defaultTrigger}
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent>
              Recent Pipeline Runs ({runs.length})
            </TooltipContent>
          </Tooltip>
          <PopoverContent className="w-[500px]">
            <PipelineRunsList
              pipelineName={pipelineName}
              overviewConfig={{
                ...overviewConfig,
                showName: false,
                showDescription: true,
              }}
              {...rest}
            />
          </PopoverContent>
        </Popover>
      </TooltipProvider>
    );
  },
  // skeleton fallback
  () => <Spinner size={20} />,
  // error fallback
  () => <List className="w-4 h-4 text-muted-foreground" />,
);
