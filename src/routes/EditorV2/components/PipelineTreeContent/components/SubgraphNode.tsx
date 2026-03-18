import { observer } from "mobx-react-lite";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import type { ComponentSpec, Task } from "@/models/componentSpec";
import { getEntityIssues, isSubgraphTask } from "@/routes/EditorV2/components/PipelineTreeContent/utils";
import { countErrors } from "@/routes/EditorV2/components/ValidationSummary";
import { setHoveredEntity } from "@/routes/EditorV2/store/editorStore";
import {
  navigateToLevel,
  navigateToPath,
  navigationStore,
} from "@/routes/EditorV2/store/navigationStore";

import { IssueBadge } from "./IssueBadge";
import { TaskLeafNode } from "./TaskLeafNode";

interface SubgraphNodeProps {
  spec: ComponentSpec;
  task: Task;
  navigationPath: string[];
  currentNavPath: string[];
  expandedNodes: Set<string>;
  onToggleExpand: (path: string) => void;
  parentSpec: ComponentSpec;
}

export const SubgraphNode = observer(function SubgraphNode({
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
          <div className="-ml-3.5">
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
          </div>
        </BlockStack>
      )}
    </BlockStack>
  );
});
