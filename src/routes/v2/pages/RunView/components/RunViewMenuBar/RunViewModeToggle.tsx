import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { InlineStack } from "@/components/ui/layout";
import { cn } from "@/lib/utils";
import type { RunViewMode } from "@/routes/v2/pages/RunView/hooks/useRunViewMode";
import { tracking } from "@/utils/tracking";

interface RunViewModeToggleProps {
  mode: RunViewMode;
  onModeChange: (mode: RunViewMode) => void;
}

export function RunViewModeToggle({
  mode,
  onModeChange,
}: RunViewModeToggleProps) {
  return (
    <div
      role="group"
      aria-label="Run visualization"
      className="rounded-md bg-white/5 p-0.5"
    >
      <InlineStack gap="1" wrap="nowrap">
        <Button
          variant="header"
          size="xs"
          aria-pressed={mode === "graph"}
          className={cn(mode === "graph" && "bg-white/15")}
          onClick={() => onModeChange("graph")}
          {...tracking("v2.run_view.mode.graph")}
        >
          <Icon name="Workflow" size="xs" />
          Graph
        </Button>
        <Button
          variant="header"
          size="xs"
          aria-pressed={mode === "timing"}
          className={cn(mode === "timing" && "bg-white/15")}
          onClick={() => onModeChange("timing")}
          {...tracking("v2.run_view.mode.timing")}
        >
          <Icon name="ChartNoAxesGantt" size="xs" />
          Timing
        </Button>
      </InlineStack>
    </div>
  );
}
