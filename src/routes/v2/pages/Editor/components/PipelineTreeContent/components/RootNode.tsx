import { observer } from "mobx-react-lite";

import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Icon } from "@/components/ui/icon";
import { BlockStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import type { ComponentSpec } from "@/models/componentSpec";
import { countErrors } from "@/routes/v2/pages/Editor/components/ValidationSummary";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

import { IssueBadge } from "./IssueBadge";
import { IssueRow } from "./IssueRow";
import { SubgraphNode } from "./SubgraphNode";
import { TaskLeafNode } from "./TaskLeafNode";
import { treeNodeIconVariants, treeNodeRowVariants } from "./treeNode.variants";

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
  const { navigation } = useSharedStores();
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
    navigation.navigateToLevel(0);
  };

  const handleChevronClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleExpand(nodePath);
  };

  return (
    <BlockStack gap="0">
      <Collapsible
        open={isExpanded}
        onOpenChange={() => onToggleExpand(nodePath)}
        className="w-full"
      >
        <CollapsibleTrigger asChild>
          <div
            role="button"
            tabIndex={0}
            onClick={handleClick}
            onKeyDown={(e) => e.key === "Enter" && handleClick()}
            className={treeNodeRowVariants({
              isCurrentGraph,
              hasErrors,
              fullWidth: true,
            })}
          >
            {hasChildren ? (
              <Button
                variant="ghost"
                size="sm"
                aria-label={isExpanded ? "Collapse" : "Expand"}
                className="h-5 w-5 p-0 shrink-0"
                onClick={handleChevronClick}
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
              name="Network"
              size="sm"
              className={cn(
                "rotate-270",
                treeNodeIconVariants({ isCurrentGraph, hasErrors }),
              )}
            />

            <Text
              size="xs"
              weight={isCurrentGraph ? "semibold" : "regular"}
              className={cn(
                "wrap-break-word min-w-0 flex-1",
                isCurrentGraph && "text-blue-900",
              )}
            >
              {spec.name}
            </Text>

            <IssueBadge issues={graphIssues} />
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
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

          {hasChildren && (
            <BlockStack gap="0" className="ml-4 border-l border-slate-200">
              <div className="-ml-1.5">
                {tasks.map((task) => {
                  if (task.subgraphSpec) {
                    return (
                      <SubgraphNode
                        key={task.$id}
                        spec={task.subgraphSpec}
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
        </CollapsibleContent>
      </Collapsible>
    </BlockStack>
  );
});
