import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input, InputGroup } from "@/components/ui/input";
import { InlineStack } from "@/components/ui/layout";
import { Link } from "@/components/ui/link";
import { GIVE_FEEDBACK_URL } from "@/utils/constants";
import { tracking } from "@/utils/tracking";

interface RunTimingToolbarProps {
  taskFilter: string;
  criticalPathOnly: boolean;
  refreshing: boolean;
  onTaskFilterChange: (value: string) => void;
  onCriticalPathOnlyChange: (value: boolean) => void;
  onRefresh: () => void;
}

export function RunTimingToolbar({
  taskFilter,
  criticalPathOnly,
  refreshing,
  onTaskFilterChange,
  onCriticalPathOnlyChange,
  onRefresh,
}: RunTimingToolbarProps) {
  return (
    <InlineStack gap="2" wrap="wrap" blockAlign="center">
      <label htmlFor="run-timing-task-filter" className="sr-only">
        Search timing tasks
      </label>
      <InputGroup
        className="w-56"
        prefixElement={
          <Icon
            name="Search"
            size="xs"
            className="ml-2 text-muted-foreground"
            aria-hidden="true"
          />
        }
      >
        <Input
          id="run-timing-task-filter"
          type="search"
          variant="noBorder"
          className="h-8 px-1"
          placeholder="Search tasks"
          value={taskFilter}
          onChange={(event) => onTaskFilterChange(event.target.value)}
          onEscape={() => onTaskFilterChange("")}
        />
      </InputGroup>
      <Button
        type="button"
        variant={criticalPathOnly ? "secondary" : "outline"}
        size="sm"
        aria-pressed={criticalPathOnly}
        onClick={() => onCriticalPathOnlyChange(!criticalPathOnly)}
        {...tracking("v2.run_view.run_timing.critical_path_filter", {
          new_value: !criticalPathOnly,
        })}
      >
        <Icon name="Route" size="xs" />
        Critical path only
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={refreshing}
        onClick={onRefresh}
        {...tracking("v2.run_view.run_timing.refresh_button")}
      >
        <Icon
          name="RefreshCw"
          size="xs"
          className={refreshing ? "animate-spin" : undefined}
        />
        {refreshing ? "Refreshing" : "Refresh"}
      </Button>
      <Button asChild variant="ghost" size="sm">
        <Link
          href={GIVE_FEEDBACK_URL}
          external
          variant="block"
          size="sm"
          {...tracking("v2.run_view.run_timing.feedback_link")}
        >
          Give feedback
        </Link>
      </Button>
    </InlineStack>
  );
}
