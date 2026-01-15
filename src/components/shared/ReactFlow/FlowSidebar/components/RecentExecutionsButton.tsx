import { List } from "lucide-react";

import { PipelineRunsList } from "@/components/shared/PipelineRunDisplay/PipelineRunsList";
import { usePipelineRuns } from "@/components/shared/PipelineRunDisplay/usePipelineRuns";
import { withSuspenseWrapper } from "@/components/shared/SuspenseWrapper";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { SidebarMenuButton } from "@/components/ui/sidebar";
import { Spinner } from "@/components/ui/spinner";
import { useComponentSpec } from "@/providers/ComponentSpecProvider";

export const RecentExecutionsButton = withSuspenseWrapper(
  ({ tooltipPosition = "top" }: { tooltipPosition?: "top" | "right" }) => {
    const { componentSpec } = useComponentSpec();

    const { data: runs } = usePipelineRuns(componentSpec?.name);

    return (
      <Popover>
        <PopoverTrigger data-popover-trigger>
          <SidebarMenuButton
            asChild
            tooltip={`Recent Pipeline Runs (${runs.length})`}
            forceTooltip
            tooltipPosition={tooltipPosition}
            className="text-black/80 rounded-md font-medium transition hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring cursor-pointer py-2 px-3"
          >
            <List className="w-4 h-4" />
          </SidebarMenuButton>
        </PopoverTrigger>
        <PopoverContent className="w-[500px]">
          <PipelineRunsList
            pipelineName={componentSpec.name}
            overviewConfig={{ showName: false, showDescription: true }}
          />
        </PopoverContent>
      </Popover>
    );
  },
  // skeleton fallback
  () => <Spinner size={20} />,
  // error fallback
  () => <List className="w-4 h-4 text-muted-foreground" />,
);
