/**
 * PipelineTreeContent - displays a tree view of the pipeline structure.
 *
 * Shows the hierarchical structure of the pipeline including all tasks.
 * Subgraph tasks are clickable and can be navigated into.
 * Regular tasks are displayed but not clickable.
 * Highlights the currently displayed graph in the tree.
 * Displays validation error badges per entity.
 */

import { observer } from "mobx-react-lite";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import type {
  ComponentSpec,
  ComponentSpecJson,
  Task,
  ValidationIssue,
} from "@/models/componentSpec";

import {
  editorStore,
  selectNode,
  setHoveredEntity,
  setPendingFocusNode,
  setSelectedValidationIssue,
} from "../store/editorStore";
import {
  navigateToLevel,
  navigateToPath,
  navigationStore,
} from "../store/navigationStore";
import { ValidationIssueResolutionCard } from "./ValidationIssueResolutionCard";

/**
 * Check if a task is a subgraph (has graph implementation).
 */
function isSubgraphTask(task: Task): boolean {
  const componentSpec = task.componentRef.spec as ComponentSpecJson | undefined;
  if (!componentSpec?.implementation) {
    return false;
  }
  return "graph" in componentSpec.implementation;
}

function getEntityIssues(
  spec: ComponentSpec,
  entityId: string,
): ValidationIssue[] {
  return spec.issuesByEntityId.get(entityId) ?? [];
}

function countErrors(issues: ValidationIssue[]): number {
  return issues.filter((i) => i.severity === "error").length;
}

function countWarnings(issues: ValidationIssue[]): number {
  return issues.filter((i) => i.severity === "warning").length;
}

interface IssueBadgeProps {
  issues: ValidationIssue[];
}

function IssueBadge({ issues }: IssueBadgeProps) {
  const errorCount = countErrors(issues);
  const warningCount = countWarnings(issues);

  if (errorCount === 0 && warningCount === 0) return null;

  if (errorCount > 0) {
    return (
      <Badge
        variant="destructive"
        size="xs"
        shape="rounded"
        className="shrink-0"
      >
        {errorCount + warningCount}
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      size="xs"
      shape="rounded"
      className="shrink-0 border-amber-400 text-amber-600"
    >
      {warningCount}
    </Badge>
  );
}

interface TaskLeafNodeProps {
  task: Task;
  parentSpec: ComponentSpec;
  parentNavigationPath: string[];
}

const TaskLeafNode = observer(function TaskLeafNode({
  task,
  parentSpec,
  parentNavigationPath,
}: TaskLeafNodeProps) {
  const issues = getEntityIssues(parentSpec, task.$id);
  const hasErrors = countErrors(issues) > 0;
  const isOnActiveCanvas = parentSpec === navigationStore.activeSpec;

  const handleClick = () => {
    navigateToPath(parentNavigationPath);
    setPendingFocusNode(task.$id);
    selectNode(task.$id, "task");
    if (issues.length > 0) {
      setSelectedValidationIssue(issues[0]);
    }
  };

  const handleMouseEnter = () => {
    if (isOnActiveCanvas) setHoveredEntity(task.$id);
  };

  const handleMouseLeave = () => {
    setHoveredEntity(null);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => e.key === "Enter" && handleClick()}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={cn(
        "flex items-start gap-1 py-1 px-2 text-slate-600 rounded-md cursor-pointer transition-colors hover:bg-slate-50",
        hasErrors && "text-red-700",
      )}
    >
      <div className="w-5 shrink-0" />
      <Icon
        name="Circle"
        size="xs"
        className={cn(
          "shrink-0 mt-0.5",
          hasErrors ? "text-red-400" : "text-slate-400",
        )}
      />
      <Text size="sm" className="break-words min-w-0 flex-1">
        {task.name}
      </Text>
      <IssueBadge issues={issues} />
    </div>
  );
});

interface SubgraphNodeProps {
  spec: ComponentSpec;
  task: Task;
  navigationPath: string[];
  currentNavPath: string[];
  expandedNodes: Set<string>;
  onToggleExpand: (path: string) => void;
  parentSpec: ComponentSpec;
}

const SubgraphNode = observer(function SubgraphNode({
  spec,
  task,
  navigationPath,
  currentNavPath,
  expandedNodes,
  onToggleExpand,
  parentSpec,
}: SubgraphNodeProps) {
  const nodePath = navigationPath.join("/");
  const isExpanded = expandedNodes.has(nodePath);
  const depth = navigationPath.length - 1;

  const isInCurrentPath =
    currentNavPath.length > depth &&
    currentNavPath.slice(0, depth + 1).join("/") === nodePath;

  const isCurrentGraph = currentNavPath.join("/") === nodePath;

  const tasks = spec.tasks;
  const hasChildren = tasks.length > 0;

  // Collect issues: task-level issues from parent + subgraph's own issues
  const taskIssues = getEntityIssues(parentSpec, task.$id);
  const specIssues = spec.validationIssues;
  const allIssues = [...taskIssues, ...specIssues];
  const hasErrors = countErrors(allIssues) > 0;

  const isParentOnActiveCanvas = parentSpec === navigationStore.activeSpec;

  const handleClick = () => {
    const pathResult = navigateToPath(navigationPath);
    if (!pathResult) {
      const parentLevel = navigationPath.length - 2;
      navigateToLevel(parentLevel);
    }
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleExpand(nodePath);
  };

  const handleMouseEnter = () => {
    if (isParentOnActiveCanvas) setHoveredEntity(task.$id);
  };

  const handleMouseLeave = () => {
    setHoveredEntity(null);
  };

  return (
    <BlockStack gap="0">
      <div
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={(e) => e.key === "Enter" && handleClick()}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={cn(
          "flex items-start gap-1 py-1.5 px-2 rounded-md cursor-pointer transition-colors",
          isCurrentGraph
            ? "bg-blue-100 text-blue-900"
            : isInCurrentPath
              ? "bg-blue-50 text-blue-800"
              : hasErrors
                ? "bg-red-50/50"
                : "hover:bg-slate-100",
        )}
      >
        {hasChildren ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-5 w-5 p-0 shrink-0"
            onClick={handleToggle}
          >
            <Icon
              name={isExpanded ? "ChevronDown" : "ChevronRight"}
              size="sm"
              className="text-slate-500"
            />
          </Button>
        ) : (
          <div className="w-5 shrink-0" />
        )}

        <Icon
          name="Layers"
          size="sm"
          className={cn(
            "shrink-0 mt-0.5",
            isCurrentGraph
              ? "text-blue-600"
              : isInCurrentPath
                ? "text-blue-500"
                : hasErrors
                  ? "text-red-500"
                  : "text-slate-500",
          )}
        />

        <Text
          size="sm"
          weight={isCurrentGraph ? "semibold" : "regular"}
          className={cn(
            "break-words min-w-0 flex-1",
            isCurrentGraph && "text-blue-900",
          )}
        >
          {task.name}
        </Text>

        <IssueBadge issues={allIssues} />

        {isCurrentGraph && (
          <Icon
            name="Eye"
            size="xs"
            className="text-blue-600 shrink-0 mt-0.5"
          />
        )}
      </div>

      {hasChildren && isExpanded && (
        <BlockStack gap="0" className="ml-4 border-l border-slate-200 pl-2">
          {tasks.map((childTask) => {
            const isChildSubgraph = isSubgraphTask(childTask);

            if (isChildSubgraph) {
              const childPathKey =
                navigationPath.slice(1).join("/") + "/" + childTask.name;
              const nestedSpec = navigationStore.nestedSpecs.get(
                childPathKey.startsWith("/")
                  ? childPathKey.slice(1)
                  : childPathKey,
              );

              if (!nestedSpec) {
                return (
                  <TaskLeafNode
                    key={childTask.$id}
                    task={childTask}
                    parentSpec={spec}
                    parentNavigationPath={navigationPath}
                  />
                );
              }

              return (
                <SubgraphNode
                  key={childTask.$id}
                  spec={nestedSpec}
                  task={childTask}
                  navigationPath={[...navigationPath, childTask.name]}
                  currentNavPath={currentNavPath}
                  expandedNodes={expandedNodes}
                  onToggleExpand={onToggleExpand}
                  parentSpec={spec}
                />
              );
            }

            return (
              <TaskLeafNode
                key={childTask.$id}
                task={childTask}
                parentSpec={spec}
                parentNavigationPath={navigationPath}
              />
            );
          })}
        </BlockStack>
      )}
    </BlockStack>
  );
});

interface RootNodeProps {
  spec: ComponentSpec;
  currentNavPath: string[];
  expandedNodes: Set<string>;
  onToggleExpand: (path: string) => void;
}

const RootNode = observer(function RootNode({
  spec,
  currentNavPath,
  expandedNodes,
  onToggleExpand,
}: RootNodeProps) {
  const navigationPath = [spec.name];
  const nodePath = navigationPath.join("/");
  const isExpanded = expandedNodes.has(nodePath);

  const isCurrentGraph = currentNavPath.join("/") === nodePath;

  const tasks = spec.tasks;
  const hasChildren = tasks.length > 0;

  const specIssues = spec.validationIssues;
  const graphIssues = spec.graphLevelIssues;
  const hasErrors = countErrors(specIssues) > 0;

  const handleClick = () => {
    navigateToLevel(0);
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleExpand(nodePath);
  };

  return (
    <BlockStack gap="0">
      <div
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={(e) => e.key === "Enter" && handleClick()}
        className={cn(
          "flex items-start gap-1 py-1.5 px-2 rounded-md cursor-pointer transition-colors",
          isCurrentGraph
            ? "bg-blue-100 text-blue-900"
            : hasErrors
              ? "bg-red-50/50 hover:bg-red-50"
              : "hover:bg-slate-100",
        )}
      >
        {hasChildren ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-5 w-5 p-0 shrink-0"
            onClick={handleToggle}
          >
            <Icon
              name={isExpanded ? "ChevronDown" : "ChevronRight"}
              size="sm"
              className="text-slate-500"
            />
          </Button>
        ) : (
          <div className="w-5 shrink-0" />
        )}

        <Icon
          name="Workflow"
          size="sm"
          className={cn(
            "shrink-0 mt-0.5",
            isCurrentGraph
              ? "text-blue-600"
              : hasErrors
                ? "text-red-500"
                : "text-slate-500",
          )}
        />

        <Text
          size="sm"
          weight={isCurrentGraph ? "semibold" : "regular"}
          className={cn(
            "break-words min-w-0 flex-1",
            isCurrentGraph && "text-blue-900",
          )}
        >
          {spec.name}
        </Text>

        <IssueBadge issues={graphIssues} />

        {isCurrentGraph && (
          <Icon
            name="Eye"
            size="xs"
            className="text-blue-600 shrink-0 mt-0.5"
          />
        )}
      </div>

      {hasChildren && isExpanded && (
        <BlockStack gap="0" className="ml-4 border-l border-slate-200 pl-2">
          {tasks.map((task) => {
            const isTaskASubgraph = isSubgraphTask(task);

            if (isTaskASubgraph) {
              const nestedSpec = navigationStore.nestedSpecs.get(task.name);

              if (!nestedSpec) {
                return (
                  <TaskLeafNode
                    key={task.$id}
                    task={task}
                    parentSpec={spec}
                    parentNavigationPath={navigationPath}
                  />
                );
              }

              return (
                <SubgraphNode
                  key={task.$id}
                  spec={nestedSpec}
                  task={task}
                  navigationPath={[...navigationPath, task.name]}
                  currentNavPath={currentNavPath}
                  expandedNodes={expandedNodes}
                  onToggleExpand={onToggleExpand}
                  parentSpec={spec}
                />
              );
            }

            return (
              <TaskLeafNode
                key={task.$id}
                task={task}
                parentSpec={spec}
                parentNavigationPath={navigationPath}
              />
            );
          })}
        </BlockStack>
      )}
    </BlockStack>
  );
});

function buildNavPathArray(
  entries: ReadonlyArray<{ readonly displayName: string }>,
): string[] {
  return entries.map((e) => e.displayName);
}

function buildExpandedPaths(navPath: string[]): Set<string> {
  const paths = new Set<string>();
  for (let i = 0; i < navPath.length; i++) {
    paths.add(navPath.slice(0, i + 1).join("/"));
  }
  return paths;
}

function issueTypeLabel(type: string): string {
  switch (type) {
    case "graph":
      return "PIPELINE";
    case "task":
      return "TASK";
    case "input":
      return "INPUT";
    case "output":
      return "OUTPUT";
    default:
      return type.toUpperCase();
  }
}

interface ValidationSummaryProps {
  spec: ComponentSpec;
}

const ValidationSummary = observer(function ValidationSummary({
  spec,
}: ValidationSummaryProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const issues = spec.validationIssues;
  const errorCount = countErrors(issues);
  const warningCount = countWarnings(issues);
  const totalCount = issues.length;

  if (totalCount === 0) return null;

  const summaryParts: string[] = [];
  if (errorCount > 0)
    summaryParts.push(`${errorCount} error${errorCount > 1 ? "s" : ""}`);
  if (warningCount > 0)
    summaryParts.push(`${warningCount} warning${warningCount > 1 ? "s" : ""}`);

  return (
    <BlockStack gap="1" className="border-t border-slate-200 pt-2">
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          "w-full justify-start gap-1.5 h-auto py-1.5",
          errorCount > 0
            ? "text-red-700 hover:bg-red-50"
            : "text-amber-700 hover:bg-amber-50",
        )}
        onClick={() => setIsExpanded((prev) => !prev)}
      >
        <Icon
          name={isExpanded ? "ChevronDown" : "ChevronRight"}
          size="sm"
          className="shrink-0"
        />
        <Icon name="TriangleAlert" size="sm" className="shrink-0" />
        <Text size="sm" weight="semibold">
          {summaryParts.join(", ")}
        </Text>
      </Button>

      {isExpanded && (
        <BlockStack gap="1" className="pl-2">
          {issues.map((issue, index) => {
            const isSelected = editorStore.selectedValidationIssue === issue;

            const handleIssueClick = () => {
              navigateToLevel(0);
              if (issue.entityId) {
                setPendingFocusNode(issue.entityId);
              }
              setSelectedValidationIssue(issue);
            };

            return (
              <div
                key={`${issue.type}-${issue.entityId ?? "graph"}-${index}`}
                role="button"
                tabIndex={0}
                onClick={handleIssueClick}
                onKeyDown={(e) => e.key === "Enter" && handleIssueClick()}
                className={cn(
                  "flex items-baseline gap-1 py-1 px-2 rounded text-xs cursor-pointer transition-colors",
                  isSelected ? "ring-1 ring-blue-400" : "",
                  issue.severity === "error"
                    ? "bg-red-50 text-red-800 hover:bg-red-100"
                    : "bg-amber-50 text-amber-800 hover:bg-amber-100",
                )}
              >
                <Text
                  size="xs"
                  weight="semibold"
                  className={cn(
                    "shrink-0 uppercase tracking-wide",
                    issue.severity === "error"
                      ? "text-red-600"
                      : "text-amber-600",
                  )}
                >
                  {issueTypeLabel(issue.type)}
                </Text>
                <Text
                  size="xs"
                  className={
                    issue.severity === "error"
                      ? "text-red-700"
                      : "text-amber-700"
                  }
                >
                  {issue.message}
                </Text>
              </div>
            );
          })}
        </BlockStack>
      )}
    </BlockStack>
  );
});

export const PipelineTreeContent = observer(function PipelineTreeContent() {
  const rootSpec = navigationStore.rootSpec;
  const { navigationPath } = navigationStore;
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  const currentNavPath = buildNavPathArray(navigationPath);

  useEffect(() => {
    const pathsToExpand = buildExpandedPaths(currentNavPath);
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      for (const path of pathsToExpand) {
        next.add(path);
      }
      return next;
    });
  }, [currentNavPath.join("/")]);

  const handleToggleExpand = (path: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const selectedIssue = editorStore.selectedValidationIssue;

  const issueStillExists =
    selectedIssue &&
    rootSpec?.validationIssues.some(
      (i) =>
        i.issueCode === selectedIssue.issueCode &&
        i.entityId === selectedIssue.entityId &&
        i.argumentName === selectedIssue.argumentName,
    );

  useEffect(() => {
    if (selectedIssue && !issueStillExists) {
      setSelectedValidationIssue(null);
    }
  }, [issueStillExists, selectedIssue]);

  const activeIssue = issueStillExists ? selectedIssue : null;

  if (!rootSpec) {
    return (
      <BlockStack className="p-4">
        <Text size="sm" tone="subdued">
          No pipeline loaded
        </Text>
      </BlockStack>
    );
  }

  return (
    <BlockStack
      className="@container h-full"
      data-testid="pipeline-tree-content"
    >
      <InlineStack
        className="flex-col @[600px]:grid @[600px]:grid-cols-[40%_60%] @[600px]:items-start h-full"
        fill
        data-testid="pipeline-tree-content-container"
      >
        <BlockStack
          gap="2"
          className="p-2 overflow-y-auto flex-1 min-h-0 @[600px]:border-r @[600px]:border-border"
        >
          <RootNode
            spec={rootSpec}
            currentNavPath={currentNavPath}
            expandedNodes={expandedNodes}
            onToggleExpand={handleToggleExpand}
          />
          <ValidationSummary spec={rootSpec} />
        </BlockStack>
        <BlockStack className="hidden @[600px]:flex overflow-y-auto min-h-0 max-w-md">
          {activeIssue ? (
            <ValidationIssueResolutionCard issue={activeIssue} />
          ) : (
            <BlockStack
              gap="2"
              align="center"
              inlineAlign="center"
              className="h-full p-4"
            >
              <Icon
                name="MousePointerClick"
                size="lg"
                className="text-slate-300"
              />
              <Text size="xs" tone="subdued" className="text-center">
                Click a validation issue to see resolution options
              </Text>
            </BlockStack>
          )}
        </BlockStack>
      </InlineStack>
    </BlockStack>
  );
});
