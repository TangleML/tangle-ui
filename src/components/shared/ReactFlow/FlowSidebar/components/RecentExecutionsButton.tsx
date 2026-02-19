import { List } from "lucide-react";

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
import { useComponentSpec } from "@/providers/ComponentSpecProvider";

export const RecentExecutionsButton = withSuspenseWrapper(
  () => {
    const { componentSpec } = useComponentSpec();

    const { data: runs } = usePipelineRuns(componentSpec?.name);

    return (
      <TooltipProvider>
        <Popover>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild data-popover-trigger>
                <Button variant="ghost" size="icon" className="size-7">
                  <List className="w-4 h-4" />
                </Button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent>
              Recent Pipeline Runs ({runs.length})
            </TooltipContent>
          </Tooltip>
          <PopoverContent className="w-[500px]">
            <PipelineRunsList
              pipelineName={componentSpec.name}
              overviewConfig={{ showName: false, showDescription: true }}
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
