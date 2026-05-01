import { observer } from "mobx-react-lite";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import type { ComponentSpec, Task } from "@/models/componentSpec";
import { getEntityIssues } from "@/routes/v2/pages/Editor/components/PipelineTreeContent/utils";
import { countErrors } from "@/routes/v2/pages/Editor/components/ValidationSummary";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

import { IssueBadge } from "./IssueBadge";
import { TaskLeafNode } from "./TaskLeafNode";
import { treeNodeIconVariants, treeNodeRowVariants } from "./treeNode.variants";

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
  const { editor, navigation } = useSharedStores();
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

  const isParentOnActiveCanvas = parentSpec === navigation.activeSpec;

  const handleClick = () => {
    const pathResult = navigation.navigateToPath(navigationPath);
    if (!pathResult) {
      const parentLevel = navigationPath.length - 2;
      navigation.navigateToLevel(parentLevel);
    }
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleExpand(nodePath);
  };

  const handleMouseEnter = () => {
    if (isParentOnActiveCanvas) editor.setHoveredEntity(task.$id);
  };

  const handleMouseLeave = () => {
    editor.setHoveredEntity(null);
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
        className={treeNodeRowVariants({
          isCurrentGraph,
          isInCurrentPath,
          hasErrors,
        })}
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
          className={treeNodeIconVariants({
            isCurrentGraph,
            isInCurrentPath,
            hasErrors,
          })}
        />

        <Text
          size="xs"
          weight={isCurrentGraph ? "semibold" : "regular"}
          className={cn(
            "wrap-break-word min-w-0 flex-1",
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
              if (childTask.subgraphSpec) {
                return (
                  <SubgraphNode
                    key={childTask.$id}
                    spec={childTask.subgraphSpec}
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
