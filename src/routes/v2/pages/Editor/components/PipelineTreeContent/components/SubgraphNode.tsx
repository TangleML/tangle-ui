import { cva } from "class-variance-authority";
import { observer } from "mobx-react-lite";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import type { ComponentSpec, Task } from "@/models/componentSpec";

const subgraphRowVariants = cva(
  "flex items-start gap-1 py-1.5 px-2 rounded-md cursor-pointer transition-colors",
  {
    variants: {
      isCurrentGraph: { true: "", false: "" },
      isInCurrentPath: { true: "", false: "" },
      hasErrors: { true: "", false: "" },
    },
    compoundVariants: [
      {
        isCurrentGraph: false,
        isInCurrentPath: false,
        hasErrors: false,
        className: "hover:bg-slate-100",
      },
      {
        isCurrentGraph: false,
        isInCurrentPath: false,
        hasErrors: true,
        className: "bg-red-50/50",
      },
      {
        isCurrentGraph: false,
        isInCurrentPath: true,
        className: "bg-blue-50 text-blue-800",
      },
      {
        isCurrentGraph: true,
        className: "bg-blue-100 text-blue-900",
      },
    ],
    defaultVariants: {
      isCurrentGraph: false,
      isInCurrentPath: false,
      hasErrors: false,
    },
  },
);

const subgraphIconVariants = cva("shrink-0 mt-0.5", {
  variants: {
    isCurrentGraph: { true: "", false: "" },
    isInCurrentPath: { true: "", false: "" },
    hasErrors: { true: "", false: "" },
  },
  compoundVariants: [
    {
      isCurrentGraph: false,
      isInCurrentPath: false,
      hasErrors: false,
      className: "text-slate-500",
    },
    {
      isCurrentGraph: false,
      isInCurrentPath: false,
      hasErrors: true,
      className: "text-red-500",
    },
    {
      isCurrentGraph: false,
      isInCurrentPath: true,
      className: "text-blue-500",
    },
    {
      isCurrentGraph: true,
      className: "text-blue-600",
    },
  ],
  defaultVariants: {
    isCurrentGraph: false,
    isInCurrentPath: false,
    hasErrors: false,
  },
});
import {
  getEntityIssues,
  isSubgraphTask,
} from "@/routes/v2/pages/Editor/components/PipelineTreeContent/utils";
import { countErrors } from "@/routes/v2/pages/Editor/components/ValidationSummary";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

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
        className={subgraphRowVariants({
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
          className={subgraphIconVariants({
            isCurrentGraph,
            isInCurrentPath,
            hasErrors,
          })}
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
                const nestedSpec = navigation.nestedSpecs.get(
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
