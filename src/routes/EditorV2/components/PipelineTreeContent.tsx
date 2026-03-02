/**
 * PipelineTreeContent - displays a tree view of the pipeline structure.
 *
 * Shows the hierarchical structure of the pipeline including all tasks.
 * Subgraph tasks are clickable and can be navigated into.
 * Regular tasks are displayed but not clickable.
 * Highlights the currently displayed graph in the tree.
 */

import { useEffect, useReducer, useState } from "react";
import { useSnapshot } from "valtio";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import type {
  ComponentSpec,
  ComponentSpecJson,
  Task,
} from "@/models/componentSpec";

import {
  navigateToLevel,
  navigateToPath,
  navigationStore,
} from "../store/navigationStore";

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

interface TaskLeafNodeProps {
  /** The task to display */
  task: Task;
}

/**
 * Leaf node for regular (non-subgraph) tasks.
 * These are displayed but not clickable.
 */
function TaskLeafNode({ task }: TaskLeafNodeProps) {
  return (
    <div className="flex items-start gap-1 py-1 px-2 text-slate-600">
      <div className="w-5 shrink-0" />
      <Icon
        name="Circle"
        size="xs"
        className="shrink-0 text-slate-400 mt-0.5"
      />
      <Text size="sm" className="break-words min-w-0">
        {task.name}
      </Text>
    </div>
  );
}

interface SubgraphNodeProps {
  /** The ComponentSpec of the subgraph */
  spec: ComponentSpec;
  /** The task entity that represents this subgraph */
  task: Task;
  /** The navigation path to this node (array of display names) */
  navigationPath: string[];
  /** The current navigation path from the store (for highlighting) */
  currentNavPath: string[];
  /** Set of expanded node paths */
  expandedNodes: Set<string>;
  /** Toggle expansion of a node */
  onToggleExpand: (path: string) => void;
}

/**
 * Node for subgraph tasks - clickable and expandable.
 */
function SubgraphNode({
  spec,
  task,
  navigationPath,
  currentNavPath,
  expandedNodes,
  onToggleExpand,
}: SubgraphNodeProps) {
  const nodePath = navigationPath.join("/");
  const isExpanded = expandedNodes.has(nodePath);
  const depth = navigationPath.length - 1;

  // Check if this node is in the current navigation path
  const isInCurrentPath =
    currentNavPath.length > depth &&
    currentNavPath.slice(0, depth + 1).join("/") === nodePath;

  // Check if this is the currently displayed graph
  const isCurrentGraph = currentNavPath.join("/") === nodePath;

  // Get all tasks from this subgraph
  const tasks = spec.tasks.all;

  const hasChildren = tasks.length > 0;

  const handleClick = () => {
    console.log("[PipelineTree] Click on subgraph:", {
      taskName: task.name,
      taskId: task.$id,
      navigationPath,
      currentNavPath,
    });

    // Try navigateToPath first
    console.log("[PipelineTree] Trying navigateToPath with:", navigationPath);
    const pathResult = navigateToPath(navigationPath);
    console.log("[PipelineTree] navigateToPath result:", pathResult);

    if (!pathResult) {
      // Fallback: navigate to parent level first, then try to find the task
      console.log("[PipelineTree] navigateToPath failed, trying fallback...");
      const parentLevel = navigationPath.length - 2;
      navigateToLevel(parentLevel);
    }
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
            : isInCurrentPath
              ? "bg-blue-50 text-blue-800"
              : "hover:bg-slate-100",
        )}
      >
        {/* Expand/collapse button */}
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

        {/* Icon - Layers for subgraphs */}
        <Icon
          name="Layers"
          size="sm"
          className={cn(
            "shrink-0 mt-0.5",
            isCurrentGraph
              ? "text-blue-600"
              : isInCurrentPath
                ? "text-blue-500"
                : "text-slate-500",
          )}
        />

        {/* Name */}
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

        {/* Current indicator */}
        {isCurrentGraph && (
          <Icon
            name="Eye"
            size="xs"
            className="text-blue-600 shrink-0 mt-0.5"
          />
        )}
      </div>

      {/* Children (all tasks) */}
      {hasChildren && isExpanded && (
        <BlockStack gap="0" className="ml-4 border-l border-slate-200 pl-2">
          {tasks.map((childTask) => {
            const isChildSubgraph = isSubgraphTask(childTask);

            if (isChildSubgraph) {
              // Get the nested spec from the nestedSpecs cache
              const childPathKey =
                navigationPath.slice(1).join("/") + "/" + childTask.name;
              const nestedSpec = navigationStore.nestedSpecs.get(
                childPathKey.startsWith("/")
                  ? childPathKey.slice(1)
                  : childPathKey,
              );

              if (!nestedSpec) {
                // Nested spec not yet loaded, show as leaf
                return <TaskLeafNode key={childTask.$id} task={childTask} />;
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
                />
              );
            }

            return <TaskLeafNode key={childTask.$id} task={childTask} />;
          })}
        </BlockStack>
      )}
    </BlockStack>
  );
}

interface RootNodeProps {
  /** The root ComponentSpec */
  spec: ComponentSpec;
  /** The current navigation path from the store (for highlighting) */
  currentNavPath: string[];
  /** Set of expanded node paths */
  expandedNodes: Set<string>;
  /** Toggle expansion of a node */
  onToggleExpand: (path: string) => void;
}

/**
 * Root node for the pipeline - always shown at depth 0.
 */
function RootNode({
  spec,
  currentNavPath,
  expandedNodes,
  onToggleExpand,
}: RootNodeProps) {
  const navigationPath = [spec.name];
  const nodePath = navigationPath.join("/");
  const isExpanded = expandedNodes.has(nodePath);

  // Check if root is the currently displayed graph
  const isCurrentGraph = currentNavPath.join("/") === nodePath;

  // Get all tasks from the root spec
  const tasks = spec.tasks.all;

  const hasChildren = tasks.length > 0;

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
          isCurrentGraph ? "bg-blue-100 text-blue-900" : "hover:bg-slate-100",
        )}
      >
        {/* Expand/collapse button */}
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

        {/* Icon - Workflow for root */}
        <Icon
          name="Workflow"
          size="sm"
          className={cn(
            "shrink-0 mt-0.5",
            isCurrentGraph ? "text-blue-600" : "text-slate-500",
          )}
        />

        {/* Name */}
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

        {/* Current indicator */}
        {isCurrentGraph && (
          <Icon
            name="Eye"
            size="xs"
            className="text-blue-600 shrink-0 mt-0.5"
          />
        )}
      </div>

      {/* Children (all tasks) */}
      {hasChildren && isExpanded && (
        <BlockStack gap="0" className="ml-4 border-l border-slate-200 pl-2">
          {tasks.map((task) => {
            const isTaskASubgraph = isSubgraphTask(task);

            if (isTaskASubgraph) {
              // Get nested spec from cache
              const nestedSpec = navigationStore.nestedSpecs.get(task.name);

              if (!nestedSpec) {
                // Nested spec not yet loaded, show as leaf
                return <TaskLeafNode key={task.$id} task={task} />;
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
                />
              );
            }

            return <TaskLeafNode key={task.$id} task={task} />;
          })}
        </BlockStack>
      )}
    </BlockStack>
  );
}

/**
 * Build the current navigation path as an array of display names.
 */
function buildNavPathArray(
  entries: ReadonlyArray<{ readonly displayName: string }>,
): string[] {
  return entries.map((e) => e.displayName);
}

/**
 * Build paths that should be expanded to show the current navigation.
 */
function buildExpandedPaths(navPath: string[]): Set<string> {
  const paths = new Set<string>();
  for (let i = 0; i < navPath.length; i++) {
    paths.add(navPath.slice(0, i + 1).join("/"));
  }
  return paths;
}

export function PipelineTreeContent() {
  const [, forceUpdate] = useReducer((x: number) => x + 1, 0);
  // Use snapshot for navigation path reactivity
  const { navigationPath } = useSnapshot(navigationStore);
  // Access rootSpec directly to avoid snapshot stripping methods
  const rootSpec = navigationStore.rootSpec;
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  // Subscribe to spec changes for reactivity
  useEffect(() => {
    if (!rootSpec) return;
    const unsubscribes: (() => void)[] = [];

    // Subscribe to tasks array changes (add/remove)
    unsubscribes.push(rootSpec.tasks.subscribe(forceUpdate));

    // Subscribe to each task's property changes (name, etc.)
    for (const task of rootSpec.tasks) {
      unsubscribes.push(task.subscribe(() => forceUpdate()));
    }

    return () => {
      unsubscribes.forEach((unsub) => unsub());
    };
  }, [rootSpec, rootSpec?.tasks.length]);

  // Build the current navigation path as array of display names
  const currentNavPath = buildNavPathArray(navigationPath);

  console.log(
    "[PipelineTreeContent] Rendering with currentNavPath:",
    currentNavPath,
  );

  // Auto-expand nodes along the current navigation path
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
    <BlockStack gap="2" className="p-2 h-full overflow-y-auto">
      <RootNode
        spec={rootSpec}
        currentNavPath={currentNavPath}
        expandedNodes={expandedNodes}
        onToggleExpand={handleToggleExpand}
      />
    </BlockStack>
  );
}
