import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import type { ComponentSpec, TaskSpec } from "@/utils/componentSpec";
import type {
  ChangeType,
  RunComparisonData,
  TaskDiff,
} from "@/utils/diff/types";

/**
 * Extracted task data for visual display
 */
interface VisualTask {
  taskId: string;
  /** Full path for nested tasks (e.g., "parent/child/grandchild") */
  fullPath: string;
  changeType: ChangeType;
  componentName?: string;
  componentDigest?: string;
  /** Arguments per run: [run1Args, run2Args, ...] */
  argumentsByRun: (Record<string, string | undefined> | undefined)[];
  /** Diff details if modified */
  diff?: TaskDiff;
  /** Nested tasks if this task has a graph implementation */
  children: VisualTask[];
  /** Nesting depth for indentation */
  depth: number;
  /** Whether this task is a subgraph */
  isSubgraph: boolean;
}

interface TasksVisualDiffProps {
  comparisonData: RunComparisonData[];
  tasksDiff: {
    added: string[];
    removed: string[];
    modified: TaskDiff[];
    unchanged: string[];
  };
  runLabels: string[];
}

const changeColors: Record<ChangeType, string> = {
  added: "border-l-green-500",
  removed: "border-l-red-500",
  modified: "border-l-yellow-500",
  unchanged: "border-l-transparent",
};

const changeDotColors: Record<ChangeType, string> = {
  added: "bg-green-500",
  removed: "bg-red-500",
  modified: "bg-yellow-500",
  unchanged: "bg-muted-foreground/30",
};

/**
 * Check if a component spec has a graph implementation
 */
function hasGraphImplementation(spec?: ComponentSpec): boolean {
  return !!(spec?.implementation && "graph" in spec.implementation);
}

/**
 * Get nested component spec from a task's componentRef
 */
function getNestedSpec(taskSpec?: TaskSpec): ComponentSpec | undefined {
  return taskSpec?.componentRef?.spec as ComponentSpec | undefined;
}

/**
 * Extract tasks from a graph implementation, handling nested subgraphs recursively
 */
function extractTasksFromGraph(
  taskSpecs: (TaskSpec | undefined)[],
  taskId: string,
  parentPath: string,
  depth: number,
  changeTypeMap: Map<string, ChangeType>,
  modifiedMap: Map<string, TaskDiff>,
): VisualTask {
  const fullPath = parentPath ? `${parentPath}/${taskId}` : taskId;
  const changeType =
    changeTypeMap.get(fullPath) ?? changeTypeMap.get(taskId) ?? "unchanged";
  const diff = modifiedMap.get(fullPath) ?? modifiedMap.get(taskId);

  // Extract arguments from each run
  const argumentsByRun = taskSpecs.map((taskSpec) => {
    if (!taskSpec?.arguments) return undefined;
    const args: Record<string, string | undefined> = {};
    for (const [key, value] of Object.entries(taskSpec.arguments)) {
      args[key] = stringifyArgValue(value);
    }
    return args;
  });

  // Get component info from first available task spec
  const firstTaskSpec = taskSpecs.find((ts) => ts !== undefined);
  const componentName =
    diff?.componentNameDiff?.values[0] ?? firstTaskSpec?.componentRef?.name;
  const componentDigest =
    diff?.digestDiff?.values[0] ?? firstTaskSpec?.componentRef?.digest;

  // Check if any run has a nested graph implementation
  const nestedSpecs = taskSpecs.map((ts) => getNestedSpec(ts));
  const hasNestedGraph = nestedSpecs.some((spec) =>
    hasGraphImplementation(spec),
  );

  // Extract children recursively if this is a subgraph
  const children: VisualTask[] = [];
  if (hasNestedGraph) {
    // Collect all nested task IDs across runs
    const nestedTaskIds: string[] = [];
    const seenNestedIds = new Set<string>();

    for (const spec of nestedSpecs) {
      if (hasGraphImplementation(spec)) {
        const nestedTasks = (
          spec!.implementation as { graph: { tasks: Record<string, TaskSpec> } }
        ).graph.tasks;
        for (const nestedTaskId of Object.keys(nestedTasks)) {
          if (!seenNestedIds.has(nestedTaskId)) {
            seenNestedIds.add(nestedTaskId);
            nestedTaskIds.push(nestedTaskId);
          }
        }
      }
    }

    // Recursively extract each nested task
    for (const nestedTaskId of nestedTaskIds) {
      const nestedTaskSpecs = nestedSpecs.map((spec) => {
        if (!hasGraphImplementation(spec)) return undefined;
        return (
          spec!.implementation as { graph: { tasks: Record<string, TaskSpec> } }
        ).graph.tasks[nestedTaskId];
      });

      children.push(
        extractTasksFromGraph(
          nestedTaskSpecs,
          nestedTaskId,
          fullPath,
          depth + 1,
          changeTypeMap,
          modifiedMap,
        ),
      );
    }
  }

  return {
    taskId,
    fullPath,
    changeType,
    componentName,
    componentDigest,
    argumentsByRun,
    diff,
    children,
    depth,
    isSubgraph: hasNestedGraph,
  };
}

/**
 * Extract all tasks from comparison data for visual display,
 * preserving the order as they appear in the YAML (first run's order as base,
 * with new tasks from other runs appended at the end).
 * Handles nested graph implementations recursively.
 */
function extractVisualTasks(
  comparisonData: RunComparisonData[],
  tasksDiff: TasksVisualDiffProps["tasksDiff"],
): VisualTask[] {
  // Build a map of change types for quick lookup
  const changeTypeMap = new Map<string, ChangeType>();
  const modifiedMap = new Map<string, TaskDiff>();

  for (const taskId of tasksDiff.added) {
    changeTypeMap.set(taskId, "added");
  }
  for (const taskId of tasksDiff.removed) {
    changeTypeMap.set(taskId, "removed");
  }
  for (const diff of tasksDiff.modified) {
    changeTypeMap.set(diff.taskId, "modified");
    modifiedMap.set(diff.taskId, diff);
  }
  for (const taskId of tasksDiff.unchanged) {
    changeTypeMap.set(taskId, "unchanged");
  }

  // Collect task IDs in YAML order from all runs, preserving first occurrence order
  const orderedTaskIds: string[] = [];
  const seenTaskIds = new Set<string>();

  for (const run of comparisonData) {
    const impl = run.componentSpec?.implementation;
    if (impl && "graph" in impl && impl.graph.tasks) {
      for (const taskId of Object.keys(impl.graph.tasks)) {
        if (!seenTaskIds.has(taskId)) {
          seenTaskIds.add(taskId);
          orderedTaskIds.push(taskId);
        }
      }
    }
  }

  // Build visual tasks in the preserved order with recursive subgraph extraction
  const tasks: VisualTask[] = [];

  for (const taskId of orderedTaskIds) {
    // Get task specs from all runs
    const taskSpecs = comparisonData.map((run) => {
      const impl = run.componentSpec?.implementation;
      if (impl && "graph" in impl) {
        return impl.graph.tasks?.[taskId] as TaskSpec | undefined;
      }
      return undefined;
    });

    tasks.push(
      extractTasksFromGraph(
        taskSpecs,
        taskId,
        "",
        0,
        changeTypeMap,
        modifiedMap,
      ),
    );
  }

  return tasks;
}

/**
 * Convert argument value to display string
 */
function stringifyArgValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    // Handle taskOutput references
    if ("taskOutput" in value) {
      const ref = value as {
        taskOutput: { taskId: string; outputName: string };
      };
      return `{{${ref.taskOutput.taskId}.${ref.taskOutput.outputName}}}`;
    }
    // Handle graphInput references
    if ("graphInput" in value) {
      const ref = value as { graphInput: { inputName: string } };
      return `{{inputs.${ref.graphInput.inputName}}}`;
    }
    return JSON.stringify(value);
  }
  return String(value);
}

/**
 * Single task node card - compact design with support for nested subgraphs
 */
const TaskNodeCard = ({
  task,
  runLabels,
  expandedTasks,
  onToggle,
}: {
  task: VisualTask;
  runLabels: string[];
  expandedTasks: Set<string>;
  onToggle: (fullPath: string) => void;
}) => {
  // Collect all unique argument keys across runs
  const allArgKeys = new Set<string>();
  task.argumentsByRun.forEach((args) => {
    if (args) Object.keys(args).forEach((k) => allArgKeys.add(k));
  });

  const hasArgs = allArgKeys.size > 0;
  const changedCount = task.diff?.argumentsDiff?.length ?? 0;
  const isExpanded = expandedTasks.has(task.fullPath);
  const hasChildren = task.children.length > 0;

  return (
    <div
      className="w-full"
      style={{
        paddingLeft: task.depth > 0 ? `${task.depth * 16}px` : undefined,
      }}
    >
      <div
        className={cn(
          "border border-border rounded bg-card border-l-2 w-full transition-colors hover:bg-muted/50",
          changeColors[task.changeType],
        )}
      >
        {/* Header - compact */}
        <button
          onClick={() => onToggle(task.fullPath)}
          className="w-full px-2 py-1.5 flex items-center gap-2 hover:bg-muted/30 transition-colors text-left"
        >
          {/* Status dot */}
          <span
            className={cn(
              "w-2 h-2 rounded-full shrink-0",
              changeDotColors[task.changeType],
            )}
          />

          {/* Subgraph indicator */}
          {task.isSubgraph && (
            <Icon
              name="GitBranch"
              className="w-3 h-3 text-muted-foreground shrink-0"
            />
          )}

          {/* Task ID */}
          <span className="font-mono text-xs font-medium truncate">
            {task.taskId}
          </span>

          {/* Component name - subdued */}
          {task.componentName && (
            <span className="text-xs text-muted-foreground truncate hidden sm:block">
              · {task.componentName}
            </span>
          )}

          {/* Spacer */}
          <span className="flex-1" />

          {/* Children count for subgraphs */}
          {hasChildren && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
              {task.children.length} tasks
            </span>
          )}

          {/* Changed count badge */}
          {changedCount > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300">
              {changedCount}Δ
            </span>
          )}

          {/* Expand icon */}
          <Icon
            name={isExpanded ? "ChevronUp" : "ChevronDown"}
            className="w-3 h-3 text-muted-foreground shrink-0"
          />
        </button>

        {/* Expanded content - arguments */}
        {isExpanded && hasArgs && (
          <div className="border-t border-border/50 bg-muted/20">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left py-1 px-2 font-medium text-muted-foreground w-1/4">
                    arg
                  </th>
                  {runLabels.map((label, i) => (
                    <th
                      key={i}
                      className="text-left py-1 px-2 font-medium text-muted-foreground"
                    >
                      {label.replace(/^Run #/, "#")}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from(allArgKeys)
                  .sort()
                  .map((argKey) => {
                    const values = task.argumentsByRun.map(
                      (args) => args?.[argKey],
                    );
                    const isChanged =
                      task.diff?.argumentsDiff?.some((d) => d.key === argKey) ??
                      false;

                    return (
                      <tr
                        key={argKey}
                        className={cn(
                          "border-b border-border/30 last:border-b-0",
                          isChanged && "bg-yellow-50/50 dark:bg-yellow-900/10",
                        )}
                      >
                        <td className="py-1 px-2 font-mono text-muted-foreground">
                          {argKey}
                        </td>
                        {values.map((val, i) => (
                          <td
                            key={i}
                            className={cn(
                              "py-1 px-2 font-mono break-all max-w-[200px] truncate",
                              isChanged &&
                                i > 0 &&
                                val !== values[0] &&
                                "text-yellow-700 dark:text-yellow-400",
                            )}
                            title={val || undefined}
                          >
                            {val || (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Nested children (subgraph tasks) */}
      {isExpanded && hasChildren && (
        <BlockStack gap="1" className="mt-1">
          {task.children.map((child) => (
            <TaskNodeCard
              key={child.fullPath}
              task={child}
              runLabels={runLabels}
              expandedTasks={expandedTasks}
              onToggle={onToggle}
            />
          ))}
        </BlockStack>
      )}
    </div>
  );
};

/**
 * Collect all task paths recursively from visual tasks
 */
function collectAllPaths(tasks: VisualTask[]): string[] {
  const paths: string[] = [];
  for (const task of tasks) {
    paths.push(task.fullPath);
    if (task.children.length > 0) {
      paths.push(...collectAllPaths(task.children));
    }
  }
  return paths;
}

/**
 * Collect paths of changed tasks (including nested)
 */
function collectChangedPaths(tasks: VisualTask[]): string[] {
  const paths: string[] = [];
  for (const task of tasks) {
    if (task.changeType !== "unchanged") {
      paths.push(task.fullPath);
    }
    if (task.children.length > 0) {
      paths.push(...collectChangedPaths(task.children));
    }
  }
  return paths;
}

/**
 * Count total tasks including nested
 */
function countAllTasks(tasks: VisualTask[]): number {
  let count = tasks.length;
  for (const task of tasks) {
    count += countAllTasks(task.children);
  }
  return count;
}

/**
 * Visual DAG comparison showing tasks as node cards
 */
export const TasksVisualDiff = ({
  comparisonData,
  tasksDiff,
  runLabels,
}: TasksVisualDiffProps) => {
  const visualTasks = extractVisualTasks(comparisonData, tasksDiff);

  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(() => {
    // Auto-expand all changed tasks (including nested)
    return new Set(collectChangedPaths(visualTasks));
  });

  const toggleTask = (fullPath: string) => {
    setExpandedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(fullPath)) {
        next.delete(fullPath);
      } else {
        next.add(fullPath);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedTasks(new Set(collectAllPaths(visualTasks)));
  };

  const collapseAll = () => {
    setExpandedTasks(new Set());
  };

  const totalTasks = countAllTasks(visualTasks);

  if (visualTasks.length === 0) {
    return (
      <div className="border border-dashed border-border rounded-md p-4">
        <Text tone="subdued">No tasks to compare.</Text>
      </div>
    );
  }

  return (
    <BlockStack gap="3">
      {/* Header - compact */}
      <InlineStack align="space-between" blockAlign="center">
        <InlineStack gap="3" blockAlign="center">
          <Text as="h3" size="sm" weight="semibold">
            Tasks ({totalTasks})
          </Text>
          {/* Inline legend */}
          <InlineStack gap="2" className="text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              {tasksDiff.added.length}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
              {tasksDiff.removed.length}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
              {tasksDiff.modified.length}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30" />
              {tasksDiff.unchanged.length}
            </span>
          </InlineStack>
        </InlineStack>
        <InlineStack gap="1">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={expandAll}
          >
            Expand
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={collapseAll}
          >
            Collapse
          </Button>
        </InlineStack>
      </InlineStack>

      {/* All tasks - tight spacing */}
      <BlockStack gap="1">
        {visualTasks.map((task) => (
          <TaskNodeCard
            key={task.fullPath}
            task={task}
            runLabels={runLabels}
            expandedTasks={expandedTasks}
            onToggle={toggleTask}
          />
        ))}
      </BlockStack>
    </BlockStack>
  );
};
