import { Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import { APP_ROUTES } from "@/routes/appRoutes";
import { tracking } from "@/utils/tracking";

import { RunPickerDialog } from "./RunPickerDialog";

const CHIP_TONE: Record<"a" | "b", string> = {
  a: "border-blue-400 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200",
  b: "border-emerald-400 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
};

const EMPTY_TONE: Record<"a" | "b", string> = {
  a: "border-blue-400 text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-300 dark:hover:bg-blue-950",
  b: "border-emerald-400 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950",
};

interface RunSwitcherProps {
  label: string;
  side: "a" | "b";
  tone: "a" | "b";
  runId?: string;
  name?: string;
  excludeRunId?: string;
  onSelect: (runId: string) => void;
  onClear: () => void;
}

export function RunSwitcher({
  label,
  side,
  tone,
  runId,
  name,
  excludeRunId,
  onSelect,
  onClear,
}: RunSwitcherProps) {
  if (!runId) {
    return (
      <RunPickerDialog
        side={side}
        excludeRunId={excludeRunId}
        onSelect={onSelect}
        trigger={
          <Button
            variant="outline"
            size="sm"
            className={cn("border-dashed", EMPTY_TONE[tone])}
            aria-label={`Select run ${label}`}
            {...tracking("compare_runs.comparison.change_run", { side: label })}
          >
            <Icon name="Plus" size="xs" />
            Select run {label}
          </Button>
        }
      />
    );
  }

  return (
    <InlineStack
      gap="1"
      blockAlign="center"
      wrap="nowrap"
      className={cn("rounded border px-2 py-1", CHIP_TONE[tone])}
    >
      <Link
        to={APP_ROUTES.RUN_DETAIL}
        params={{ id: runId }}
        target="_blank"
        rel="noopener noreferrer"
        title={`Open ${name ?? runId} in a new tab`}
        className="group min-w-0"
        {...tracking("compare_runs.comparison.open_run", { side: label })}
      >
        <InlineStack
          gap="2"
          blockAlign="center"
          wrap="nowrap"
          className="min-w-0"
        >
          <Text as="span" size="sm" weight="semibold" className="text-inherit">
            {label}
          </Text>
          <Text as="span" size="sm" className="max-w-48 truncate text-inherit">
            {name ?? `Run #${runId}`}
          </Text>
          <Text as="span" size="xs" className="text-inherit opacity-70">
            #{runId}
          </Text>
          <Icon
            name="ExternalLink"
            size="xs"
            className="opacity-40 group-hover:opacity-80"
          />
        </InlineStack>
      </Link>
      <RunPickerDialog
        side={side}
        excludeRunId={excludeRunId}
        onSelect={onSelect}
        trigger={
          <Button
            variant="ghost"
            size="icon"
            className="size-6 text-inherit"
            aria-label={`Change run ${label}`}
            {...tracking("compare_runs.comparison.change_run", { side: label })}
          >
            <Icon name="Replace" size="xs" />
          </Button>
        }
      />
      <Button
        variant="ghost"
        size="icon"
        className="size-6 text-inherit"
        aria-label={`Clear run ${label}`}
        onClick={onClear}
        {...tracking("compare_runs.comparison.clear_run", { side: label })}
      >
        <Icon name="X" size="xs" />
      </Button>
    </InlineStack>
  );
}
