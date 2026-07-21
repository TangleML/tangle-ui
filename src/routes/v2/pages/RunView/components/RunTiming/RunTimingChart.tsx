import {
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  useState,
} from "react";

import StatusIcon from "@/components/shared/Status/StatusIcon";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import { getExecutionStatusLabel } from "@/utils/executionStatus";
import { tracking } from "@/utils/tracking";

import { formatTimingDuration } from "./runTiming";
import type {
  RunTimingData,
  RunTimingPhase,
  RunTimingTask,
} from "./runTiming.types";

const DEFAULT_TASK_COLUMN_WIDTH = 320;
const MIN_TASK_COLUMN_WIDTH = 240;
const MAX_TASK_COLUMN_WIDTH = 640;
const TASK_COLUMN_RESIZE_STEP = 16;
const TIMELINE_EDGE_PADDING = 12;
const MIN_TIMELINE_WIDTH = 1200;
const TICK_COUNT = 5;

const PHASE_CLASS: Record<RunTimingPhase["name"], string> = {
  startup: "bg-slate-400 dark:bg-slate-500",
  runtime: "bg-emerald-600 dark:bg-emerald-500",
};

function orderedTasks(tasks: RunTimingTask[]): RunTimingTask[] {
  const rootParentId = tasks.find(
    (task) => task.depth === 0,
  )?.parentExecutionId;
  if (!rootParentId) return tasks;

  const childrenByParent = new Map<string, RunTimingTask[]>();
  for (const task of tasks) {
    const siblings = childrenByParent.get(task.parentExecutionId) ?? [];
    siblings.push(task);
    childrenByParent.set(task.parentExecutionId, siblings);
  }

  const ordered: RunTimingTask[] = [];
  const appendChildren = (parentExecutionId: string) => {
    for (const task of childrenByParent.get(parentExecutionId) ?? []) {
      ordered.push(task);
      if (task.isSubgraph) appendChildren(task.executionId);
    }
  };
  appendChildren(rootParentId);
  return ordered;
}

function percentage(value: number, start: number, duration: number): number {
  return ((value - start) / duration) * 100;
}

function TimelineGridLines({ ticks }: { ticks: number[] }) {
  return (
    <>
      {ticks.map((_, index) => (
        <span
          key={index}
          aria-hidden="true"
          className="absolute inset-y-0 border-l border-border/60"
          style={{ left: `${(index / (ticks.length - 1)) * 100}%` }}
        />
      ))}
    </>
  );
}

function PhaseSegment({
  phase,
  rangeStart,
  rangeDuration,
}: {
  phase: RunTimingPhase;
  rangeStart: number;
  rangeDuration: number;
}) {
  const left = percentage(phase.startAt, rangeStart, rangeDuration);
  const width = (phase.durationMs / rangeDuration) * 100;
  const phaseLabel = phase.name === "startup" ? "startup / queue" : "runtime";
  const label = `${phaseLabel} ${formatTimingDuration(phase.durationMs)}`;

  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={cn("absolute inset-y-0", PHASE_CLASS[phase.name])}
      style={{ left: `${left}%`, width: `max(2px, ${width}%)` }}
    />
  );
}

function TaskBar({
  task,
  rangeStart,
  rangeDuration,
  critical,
}: {
  task: RunTimingTask;
  rangeStart: number;
  rangeDuration: number;
  critical: boolean;
}) {
  if (task.cacheState === "hit") {
    return (
      <span
        role="img"
        aria-label="Cache hit; no container runtime in this run"
        title="Cache hit; no container runtime in this run"
        className={cn(
          "absolute top-2 left-0 h-6 w-2 rounded-sm border border-slate-400 bg-slate-300 dark:bg-slate-600",
          critical && "ring-2 ring-violet-500 ring-offset-1",
        )}
      />
    );
  }

  if (task.startAt === undefined || task.endAt === undefined) {
    return (
      <Text
        size="xs"
        tone="subdued"
        className="absolute inset-0 content-center px-3"
      >
        Timing unavailable
      </Text>
    );
  }

  if (task.isSubgraph) {
    const left = percentage(task.startAt, rangeStart, rangeDuration);
    const width = ((task.endAt - task.startAt) / rangeDuration) * 100;
    const label = `Subgraph span ${formatTimingDuration(task.durationMs)}`;
    return (
      <span
        role="img"
        aria-label={label}
        title={label}
        className={cn(
          "absolute top-2 h-6 rounded-sm bg-blue-500/70",
          critical && "ring-2 ring-violet-500 ring-offset-1",
        )}
        style={{ left: `${left}%`, width: `max(2px, ${width}%)` }}
      />
    );
  }

  return (
    <span
      className={cn(
        "absolute top-2 h-6 overflow-hidden rounded-sm",
        critical && "ring-2 ring-violet-500 ring-offset-1",
      )}
      style={{
        left: `${percentage(task.startAt, rangeStart, rangeDuration)}%`,
        width: `max(2px, ${((task.durationMs ?? 0) / rangeDuration) * 100}%)`,
      }}
    >
      {task.phases.map((phase) => (
        <PhaseSegment
          key={`${phase.name}-${phase.startAt}`}
          phase={phase}
          rangeStart={task.startAt ?? rangeStart}
          rangeDuration={Math.max(1, task.durationMs ?? rangeDuration)}
        />
      ))}
    </span>
  );
}

interface TaskColumnResizeHandleProps {
  width: number;
  onWidthChange: (width: number) => void;
}

function TaskColumnResizeHandle({
  width,
  onWidthChange,
}: TaskColumnResizeHandleProps) {
  const constrainWidth = (nextWidth: number) =>
    Math.max(MIN_TASK_COLUMN_WIDTH, Math.min(MAX_TASK_COLUMN_WIDTH, nextWidth));

  const handleMouseDown = (event: ReactMouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startWidth = width;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      onWidthChange(constrainWidth(startWidth + moveEvent.clientX - startX));
    };
    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    let nextWidth = width;
    if (event.key === "ArrowLeft") nextWidth -= TASK_COLUMN_RESIZE_STEP;
    else if (event.key === "ArrowRight") nextWidth += TASK_COLUMN_RESIZE_STEP;
    else if (event.key === "Home") nextWidth = MIN_TASK_COLUMN_WIDTH;
    else if (event.key === "End") nextWidth = MAX_TASK_COLUMN_WIDTH;
    else return;

    event.preventDefault();
    onWidthChange(constrainWidth(nextWidth));
  };

  return (
    <div
      role="separator"
      aria-label="Resize task name column"
      aria-orientation="vertical"
      aria-valuemin={MIN_TASK_COLUMN_WIDTH}
      aria-valuemax={MAX_TASK_COLUMN_WIDTH}
      aria-valuenow={width}
      tabIndex={0}
      title="Drag to resize the task name column"
      className="group absolute inset-y-0 right-0 z-40 w-2 translate-x-1/2 cursor-col-resize focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
      onMouseDown={handleMouseDown}
      onDoubleClick={() => onWidthChange(DEFAULT_TASK_COLUMN_WIDTH)}
      onKeyDown={handleKeyDown}
    >
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border group-hover:bg-primary group-focus-visible:bg-primary"
      />
    </div>
  );
}

function TimingLegend() {
  return (
    <InlineStack gap="4" wrap="wrap" blockAlign="center">
      {Object.entries(PHASE_CLASS).map(([phase, className]) => (
        <InlineStack key={phase} gap="1" wrap="nowrap" blockAlign="center">
          <span
            aria-hidden="true"
            className={cn("size-2.5 rounded-sm", className)}
          />
          <Text size="xs" className="capitalize">
            {phase === "startup" ? "Startup / queue" : phase}
          </Text>
        </InlineStack>
      ))}
      <InlineStack gap="1" wrap="nowrap" blockAlign="center">
        <span
          aria-hidden="true"
          className="size-2.5 rounded-sm border border-slate-400 bg-slate-300 dark:bg-slate-600"
        />
        <Text size="xs">Cache hit</Text>
      </InlineStack>
      <InlineStack gap="1" wrap="nowrap" blockAlign="center">
        <span
          aria-hidden="true"
          className="size-2.5 rounded-sm border-2 border-violet-500"
        />
        <Text size="xs">Critical path</Text>
      </InlineStack>
      <InlineStack gap="1" wrap="nowrap" blockAlign="center">
        <span
          aria-hidden="true"
          className="size-2.5 rounded-sm bg-blue-500/70"
        />
        <Text size="xs">Subgraph span</Text>
      </InlineStack>
    </InlineStack>
  );
}

interface RunTimingChartProps {
  data: RunTimingData;
  taskFilter?: string;
  criticalPathOnly?: boolean;
  onTaskSelect?: (task: RunTimingTask) => void;
}

export function RunTimingChart({
  data,
  taskFilter = "",
  criticalPathOnly = false,
  onTaskSelect,
}: RunTimingChartProps) {
  const [taskColumnWidth, setTaskColumnWidth] = useState(
    DEFAULT_TASK_COLUMN_WIDTH,
  );
  const normalizedFilter = taskFilter.trim().toLocaleLowerCase();
  const tasks = orderedTasks(data.tasks).filter((task) => {
    const matchesFilter =
      normalizedFilter.length === 0 ||
      task.taskName.toLocaleLowerCase().includes(normalizedFilter) ||
      task.componentName?.toLocaleLowerCase().includes(normalizedFilter);
    const matchesCriticalPath =
      !criticalPathOnly || data.criticalPathExecutionIds.has(task.executionId);
    return matchesFilter && matchesCriticalPath;
  });
  const rangeStart = data.rangeStart;
  const rangeEnd = data.rangeEnd;

  if (tasks.length === 0) {
    const filtersActive = normalizedFilter.length > 0 || criticalPathOnly;
    return (
      <Text tone="subdued" className="p-6 text-center">
        {filtersActive
          ? "No tasks match the current filters."
          : "This run has no task executions yet."}
      </Text>
    );
  }

  if (rangeStart === undefined || rangeEnd === undefined) {
    return (
      <Text tone="subdued" className="p-6 text-center">
        Timing data is not available for this run.
      </Text>
    );
  }

  const rangeDuration = Math.max(1, rangeEnd - rangeStart);
  const ticks = Array.from(
    { length: TICK_COUNT },
    (_, index) => rangeStart + (rangeDuration * index) / (TICK_COUNT - 1),
  );
  const gridStyle = {
    gridTemplateColumns: `${taskColumnWidth}px minmax(${MIN_TIMELINE_WIDTH}px, 1fr)`,
    minWidth: `${taskColumnWidth + MIN_TIMELINE_WIDTH}px`,
  };

  return (
    <div
      className="min-h-0 min-w-0 w-full max-w-full flex-1 overflow-auto rounded-lg border"
      role="table"
      aria-label="Run timing"
    >
      <div
        role="row"
        className="sticky top-0 z-20 grid h-11 border-b bg-muted"
        style={gridStyle}
      >
        <div
          role="columnheader"
          className="sticky left-0 z-30 content-center border-r bg-muted px-3"
        >
          <Text size="xs" weight="semibold">
            Task
          </Text>
          <TaskColumnResizeHandle
            width={taskColumnWidth}
            onWidthChange={setTaskColumnWidth}
          />
        </div>
        <div role="columnheader" className="relative">
          {ticks.map((tick, index) => (
            <span
              key={tick}
              className="absolute bottom-2"
              style={
                index === 0
                  ? { left: TIMELINE_EDGE_PADDING }
                  : index === ticks.length - 1
                    ? { right: TIMELINE_EDGE_PADDING }
                    : {
                        left: `${(index / (ticks.length - 1)) * 100}%`,
                        transform: `translateX(-${(index / (ticks.length - 1)) * 100}%)`,
                      }
              }
            >
              <Text size="xs" tone="subdued">
                {formatTimingDuration(tick - rangeStart)}
              </Text>
            </span>
          ))}
        </div>
      </div>

      {tasks.map((task) => {
        const critical = data.criticalPathExecutionIds.has(task.executionId);
        return (
          <div
            key={task.executionId}
            role="row"
            className="grid h-11 border-b last:border-b-0"
            style={gridStyle}
            data-execution-id={task.executionId}
          >
            <div
              role="cell"
              className="sticky left-0 z-10 min-w-0 border-r bg-background"
            >
              <Button
                type="button"
                variant="ghost"
                size="min"
                className="h-full w-full justify-start rounded-none px-3 font-normal"
                style={{ paddingLeft: `${12 + task.depth * 16}px` }}
                onClick={() => onTaskSelect?.(task)}
                aria-label={`Open ${task.taskName} task details`}
                {...tracking("v2.run_view.run_timing.task", {
                  depth: task.depth,
                  is_subgraph: task.isSubgraph,
                })}
              >
                <StatusIcon status={task.status} />
                {task.cacheState === "hit" && (
                  <Text aria-hidden="true" tone="subdued" className="shrink-0">
                    ⟲
                  </Text>
                )}
                {task.isSubgraph && (
                  <Icon
                    name="Workflow"
                    size="xs"
                    className="shrink-0 text-blue-500"
                  />
                )}
                {critical && (
                  <>
                    <Icon
                      name="Route"
                      size="xs"
                      className="shrink-0 text-violet-500"
                    />
                    <span className="sr-only">Critical path task. </span>
                  </>
                )}
                <Text
                  size="sm"
                  className="min-w-0 flex-1 truncate text-left"
                  title={task.taskName}
                >
                  {task.taskName}
                </Text>
                <Text size="xs" tone="subdued" className="shrink-0">
                  {formatTimingDuration(task.durationMs)}
                </Text>
                <span className="sr-only">
                  Status: {getExecutionStatusLabel(task.status)}.
                  {task.cacheState === "hit" && " Cache hit."}
                </span>
              </Button>
            </div>
            <div role="cell" className="relative bg-muted/15">
              <TimelineGridLines ticks={ticks} />
              <TaskBar
                task={task}
                rangeStart={rangeStart}
                rangeDuration={rangeDuration}
                critical={critical}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function RunTimingChartLegend() {
  return <TimingLegend />;
}
