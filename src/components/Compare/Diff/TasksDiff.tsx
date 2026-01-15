import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import type { RunDiffResult, TaskDiff as TaskDiffType } from "@/utils/diff/types";

import { ValueDiffInline } from "./ValueDiffDisplay";

interface TasksDiffProps {
  tasks: RunDiffResult["tasks"];
}

const TaskBadge = ({
  taskId,
  type,
}: {
  taskId: string;
  type: "added" | "removed" | "modified" | "unchanged";
}) => {
  const styles = {
    added: "bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700",
    removed: "bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700",
    modified: "bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-700",
    unchanged: "bg-muted text-muted-foreground border-border",
  };

  const icons = {
    added: "Plus",
    removed: "Minus",
    modified: "Pencil",
    unchanged: "Check",
  };

  return (
    <InlineStack
      gap="2"
      blockAlign="center"
      className={cn("px-2 py-1 rounded border text-sm", styles[type])}
    >
      <Icon name={icons[type] as any} className="w-3 h-3" />
      <span className="font-mono">{taskId}</span>
    </InlineStack>
  );
};

const TaskDetailDiff = ({
  task,
}: {
  task: TaskDiffType;
}) => {
  const hasDetails =
    task.digestDiff || task.componentNameDiff || task.argumentsDiff.length > 0;

  if (!hasDetails) {
    return null;
  }

  return (
    <BlockStack gap="2" className="pl-4 border-l-2 border-yellow-400">
      {task.componentNameDiff && (
        <ValueDiffInline diff={task.componentNameDiff} />
      )}
      {task.digestDiff && <ValueDiffInline diff={task.digestDiff} />}
      {task.argumentsDiff.length > 0 && (
        <BlockStack gap="1">
          <Text size="sm" weight="semibold">
            Changed Arguments:
          </Text>
          {task.argumentsDiff.map((argDiff) => (
            <ValueDiffInline key={argDiff.key} diff={argDiff} />
          ))}
        </BlockStack>
      )}
    </BlockStack>
  );
};

export const TasksDiff = ({ tasks }: TasksDiffProps) => {
  const { added, removed, modified, unchanged } = tasks;
  const hasChanges = added.length > 0 || removed.length > 0 || modified.length > 0;

  if (!hasChanges && unchanged.length === 0) {
    return (
      <div className="border border-dashed border-border rounded-md p-4">
        <Text tone="subdued">No tasks to compare.</Text>
      </div>
    );
  }

  return (
    <BlockStack gap="4">
      <InlineStack align="space-between" blockAlign="center">
        <Text as="h3" size="lg" weight="semibold">
          Tasks
        </Text>
        <Text size="sm" tone="subdued">
          {added.length + removed.length + modified.length} changed,{" "}
          {unchanged.length} unchanged
        </Text>
      </InlineStack>

      {/* Added tasks */}
      {added.length > 0 && (
        <BlockStack gap="2">
          <InlineStack gap="2" blockAlign="center">
            <Icon name="Plus" className="w-4 h-4 text-green-600" />
            <Text size="sm" weight="semibold">
              Added Tasks ({added.length})
            </Text>
          </InlineStack>
          <InlineStack gap="2" wrap="wrap">
            {added.map((taskId) => (
              <TaskBadge key={taskId} taskId={taskId} type="added" />
            ))}
          </InlineStack>
        </BlockStack>
      )}

      {/* Removed tasks */}
      {removed.length > 0 && (
        <BlockStack gap="2">
          <InlineStack gap="2" blockAlign="center">
            <Icon name="Minus" className="w-4 h-4 text-red-600" />
            <Text size="sm" weight="semibold">
              Removed Tasks ({removed.length})
            </Text>
          </InlineStack>
          <InlineStack gap="2" wrap="wrap">
            {removed.map((taskId) => (
              <TaskBadge key={taskId} taskId={taskId} type="removed" />
            ))}
          </InlineStack>
        </BlockStack>
      )}

      {/* Modified tasks */}
      {modified.length > 0 && (
        <BlockStack gap="2">
          <InlineStack gap="2" blockAlign="center">
            <Icon name="Pencil" className="w-4 h-4 text-yellow-600" />
            <Text size="sm" weight="semibold">
              Modified Tasks ({modified.length})
            </Text>
          </InlineStack>
          <Accordion type="multiple" className="w-full">
            {modified.map((task) => (
              <AccordionItem key={task.taskId} value={task.taskId}>
                <AccordionTrigger>
                  <TaskBadge taskId={task.taskId} type="modified" />
                </AccordionTrigger>
                <AccordionContent>
                  <TaskDetailDiff task={task} />
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </BlockStack>
      )}

      {/* Unchanged tasks (collapsible) */}
      {unchanged.length > 0 && (
        <Accordion type="single" collapsible>
          <AccordionItem value="unchanged">
            <AccordionTrigger>
              <Text size="sm" tone="subdued">
                {unchanged.length} unchanged tasks
              </Text>
            </AccordionTrigger>
            <AccordionContent>
              <InlineStack gap="2" wrap="wrap">
                {unchanged.map((taskId) => (
                  <TaskBadge key={taskId} taskId={taskId} type="unchanged" />
                ))}
              </InlineStack>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}
    </BlockStack>
  );
};

