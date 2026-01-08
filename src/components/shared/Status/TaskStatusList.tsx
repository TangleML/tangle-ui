import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { useTaskNavigation } from "@/hooks/useTaskNavigation";
import { cn } from "@/lib/utils";
import type { TaskStatusInfo } from "@/utils/collectTaskStatuses";
import {
  EXECUTION_STATUS_BG_COLORS,
  getExecutionStatusLabel,
} from "@/utils/executionStatus";

const STATUS_GROUP_ORDER = [
  "FAILED",
  "SYSTEM_ERROR",
  "INVALID",
  "CANCELLED",
  "CANCELLING",
  "RUNNING",
  "PENDING",
  "QUEUED",
  "WAITING_FOR_UPSTREAM",
  "UNINITIALIZED",
  "SUCCEEDED",
  "SKIPPED",
  "UNKNOWN",
];

const DEFAULT_EXPANDED_STATUSES = new Set([
  "FAILED",
  "SYSTEM_ERROR",
  "INVALID",
]);

const shouldDefaultExpandStatus = (status: string): boolean =>
  DEFAULT_EXPANDED_STATUSES.has(status);

const getStatusDotColor = (status: string): string => {
  return EXECUTION_STATUS_BG_COLORS[status] ?? "bg-slate-400";
};

const isKnownStatus = (status: string): boolean => {
  return STATUS_GROUP_ORDER.includes(status);
};

interface TaskStatusItemProps {
  task: TaskStatusInfo;
  onClick: () => void;
}

const TaskStatusItem = ({ task, onClick }: TaskStatusItemProps) => {
  const pathDisplay =
    task.subgraphPath.length > 1
      ? task.subgraphPath.slice(1).join(" → ")
      : null;

  const showTaskId = task.taskId !== task.taskName;

  return (
    <Button
      variant="ghost"
      size="sm"
      className="w-full justify-start h-auto py-1 px-1"
      onClick={onClick}
    >
      <BlockStack gap="0" className="min-w-0">
        <Text as="span" size="xs" className="truncate block">
          <Text as="span" weight="semibold">
            {task.taskName}
          </Text>
          {showTaskId && (
            <Text as="span" tone="subdued">
              {" - "}
              {task.taskId}
            </Text>
          )}
        </Text>
        {pathDisplay && (
          <Text as="span" size="xs" tone="subdued" className="truncate block">
            in {pathDisplay}
          </Text>
        )}
      </BlockStack>
    </Button>
  );
};

interface StatusGroupProps {
  status: string;
  tasks: TaskStatusInfo[];
  onTaskClick: (task: TaskStatusInfo) => void;
  defaultExpanded?: boolean;
}

const StatusGroup = ({
  status,
  tasks,
  onTaskClick,
  defaultExpanded = false,
}: StatusGroupProps) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const statusLabel = getExecutionStatusLabel(status);
  const statusColor = getStatusDotColor(status);

  return (
    <Collapsible
      open={isExpanded}
      onOpenChange={setIsExpanded}
      className="w-full border-t border-border/40 first:border-t-0"
    >
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-between h-auto py-1 px-1"
          aria-expanded={isExpanded}
        >
          <InlineStack gap="2" blockAlign="center">
            <Badge variant="dot" className={statusColor} />
            <Text as="span" size="xs">
              {statusLabel}
            </Text>
            <Badge size="sm" variant="secondary" className="rounded-full">
              {tasks.length}
            </Badge>
          </InlineStack>
          <Icon
            name="ChevronRight"
            size="xs"
            className={cn(
              "text-muted-foreground transition-transform duration-200",
              isExpanded && "rotate-90",
            )}
          />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="w-full">
        <BlockStack gap="0" className="pl-4 w-full divide-y divide-border/40">
          {tasks.map((task) => (
            <TaskStatusItem
              key={`${task.subgraphPath.join(".")}.${task.taskId}`}
              task={task}
              onClick={() => onTaskClick(task)}
            />
          ))}
        </BlockStack>
      </CollapsibleContent>
    </Collapsible>
  );
};

const groupTasksByStatus = (
  tasks: TaskStatusInfo[],
): Array<{ status: string; tasks: TaskStatusInfo[] }> => {
  const groups = new Map<string, TaskStatusInfo[]>();

  for (const task of tasks) {
    const existing = groups.get(task.status);
    if (existing) {
      existing.push(task);
    } else {
      groups.set(task.status, [task]);
    }
  }

  const result: Array<{ status: string; tasks: TaskStatusInfo[] }> = [];

  for (const status of STATUS_GROUP_ORDER) {
    const groupTasks = groups.get(status);
    if (groupTasks && groupTasks.length > 0) {
      result.push({ status, tasks: groupTasks });
    }
  }

  for (const [status, groupTasks] of groups.entries()) {
    if (!isKnownStatus(status)) {
      result.push({ status, tasks: groupTasks });
    }
  }

  return result;
};

interface TaskStatusListProps {
  tasks: TaskStatusInfo[];
  rootExecutionId?: string;
}

export const TaskStatusList = ({
  tasks,
  rootExecutionId,
}: TaskStatusListProps) => {
  const { navigateToTask } = useTaskNavigation({ rootExecutionId });
  const groupedTasks = groupTasksByStatus(tasks);

  if (groupedTasks.length === 0) {
    return (
      <BlockStack className="py-2 px-1">
        <Text size="xs" tone="subdued">
          No tasks found
        </Text>
      </BlockStack>
    );
  }

  return (
    <BlockStack gap="1" className="w-full" data-task-status-list>
      {groupedTasks.map(({ status, tasks: groupTasks }) => (
        <StatusGroup
          key={status}
          status={status}
          tasks={groupTasks}
          onTaskClick={navigateToTask}
          defaultExpanded={shouldDefaultExpandStatus(status)}
        />
      ))}
    </BlockStack>
  );
};
