import { observer } from "mobx-react-lite";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import type { ComponentSpec } from "@/models/componentSpec";

import {
  navigateToLevel,
  navigationStore,
} from "../../../store/navigationStore";
import { countErrors } from "../../ValidationSummary";
import { isSubgraphTask } from "../utils";
import { IssueBadge } from "./IssueBadge";
import { IssueRow } from "./IssueRow";
import { SubgraphNode } from "./SubgraphNode";
import { TaskLeafNode } from "./TaskLeafNode";

interface RootNodeProps {
  spec: ComponentSpec;
  currentNavPath: string[];
  expandedNodes: Set<string>;
  onToggleExpand: (path: string) => void;
}

export const RootNode = observer(function RootNode({
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
          "flex items-start w-full gap-1 py-1.5 px-2 rounded-md cursor-pointer transition-colors",
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

      {graphIssues.length > 0 && (
        <BlockStack gap="1" className="ml-10 mt-0.5 mb-1">
          {graphIssues.map((issue, index) => (
            <IssueRow
              key={`${issue.type}-${issue.entityId ?? "graph"}-${index}`}
              issue={issue}
            />
          ))}
        </BlockStack>
      )}

      {hasChildren && isExpanded && (
        <BlockStack gap="0" className="ml-4 border-l border-slate-200">
          <div className="-ml-1.5">
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
          </div>
        </BlockStack>
      )}
    </BlockStack>
  );
});
