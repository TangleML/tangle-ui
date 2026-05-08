import { observer } from "mobx-react-lite";

import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import type { ComponentSpec, Task } from "@/models/componentSpec";
import { getEntityIssues } from "@/routes/v2/pages/Editor/components/PipelineTreeContent/utils";
import { countErrors } from "@/routes/v2/pages/Editor/components/ValidationSummary";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";
import { tracking } from "@/utils/tracking";

import { IssueBadge } from "./IssueBadge";
import { IssueRow } from "./IssueRow";
import { TaskLeafNode } from "./TaskLeafNode";
import {
  treeNodeChevronIconVariants,
  treeNodeIconVariants,
  treeNodeLabelToneVariants,
  treeNodeRowVariants,
} from "./treeNode.variants";
import { TreeRowActivate } from "./TreeRowActivate";

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

  const tasks = spec.tasks;
  const hasChildren = tasks.length > 0;
  const childTaskIds = new Set(tasks.map((t) => t.$id));

  const taskIssues = getEntityIssues(parentSpec, task.$id);
  const specIssuesWithoutChildTaskRow = spec.validationIssues.filter(
    (issue) => !issue.entityId || !childTaskIds.has(issue.entityId),
  );
  const ownIssues = [...taskIssues, ...specIssuesWithoutChildTaskRow];
  const allIssues = [...taskIssues, ...spec.allValidationIssues];
  const hasErrors = countErrors(allIssues) > 0;

  const isSelected = editor.isTaskSelected(task.$id);

  const handleClick = () => {
    const pathResult = navigation.navigateToPath(navigationPath);
    if (!pathResult) {
      const parentLevel = navigationPath.length - 2;
      navigation.navigateToLevel(parentLevel);
    }
  };

  const collapsibleOpen = hasChildren ? isExpanded : true;

  return (
    <BlockStack gap="0" align="stretch" className="min-w-0 w-full">
      <Collapsible
        open={collapsibleOpen}
        onOpenChange={() => onToggleExpand(nodePath)}
        className="w-full"
      >
        <div
          className={treeNodeRowVariants({
            hasErrors,
            fullWidth: true,
          })}
        >
          <TreeRowActivate
            layout="subgraphStrip"
            selected={isSelected}
            taskId={task.$id}
            onActivate={handleClick}
            trackingId="v2.pipeline_editor.pipeline_tree.subgraph_nav"
          >
            <InlineStack
              className="shrink-0 rounded-sm bg-white"
              gap="0"
              align="center"
              blockAlign="center"
            >
              <Icon
                name="Workflow"
                size="xs"
                className={cn(
                  treeNodeIconVariants({
                    hasErrors,
                    selected: isSelected,
                  }),
                )}
              />
            </InlineStack>

            <Text
              size="xs"
              weight={isInCurrentPath ? "semibold" : "regular"}
              title={task.name}
              className={treeNodeLabelToneVariants({
                tone: "none",
                line: "ellipsis",
              })}
            >
              {task.name}
            </Text>

            <IssueBadge issues={allIssues} />
          </TreeRowActivate>

          {hasChildren && (
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 w-5 shrink-0 p-0"
                aria-label={
                  isExpanded ? "Collapse subgraph" : "Expand subgraph"
                }
                {...tracking(
                  "v2.pipeline_editor.pipeline_tree.subgraph_expand_toggle",
                )}
              >
                <Icon
                  name={isExpanded ? "ChevronDown" : "ChevronRight"}
                  size="sm"
                  className={treeNodeChevronIconVariants({ hasErrors })}
                />
              </Button>
            </CollapsibleTrigger>
          )}
        </div>

        <CollapsibleContent className="w-full">
          {ownIssues.length > 0 && (
            <BlockStack gap="1" className="ml-7 mt-0.5 mb-1">
              {ownIssues.map((issue, index) => (
                <IssueRow
                  key={`${issue.type}-${issue.entityId ?? "graph"}-${index}`}
                  issue={issue}
                />
              ))}
            </BlockStack>
          )}

          {hasChildren && (
            <BlockStack
              gap="0"
              align="stretch"
              className="ml-4 min-w-0 w-full border-l border-slate-200 pl-2"
            >
              <div className="-ml-3.5 min-w-0 w-full">
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
        </CollapsibleContent>
      </Collapsible>
    </BlockStack>
  );
});
