import { observer } from "mobx-react-lite";

import { BlockStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import type { ComponentSpec } from "@/models/componentSpec";
import { countErrors } from "@/routes/v2/pages/Editor/components/ValidationSummary";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

import { IssueBadge } from "./IssueBadge";
import { IssueRow } from "./IssueRow";
import { SubgraphNode } from "./SubgraphNode";
import { TaskLeafNode } from "./TaskLeafNode";
import {
  treeNodeLabelToneVariants,
  treeNodeRowVariants,
} from "./treeNode.variants";
import { TreeRowActivate } from "./TreeRowActivate";

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

  const tasks = spec.tasks;
  const hasChildren = tasks.length > 0;

  const specIssues = spec.validationIssues;
  const graphIssues = spec.graphLevelIssues;
  const hasErrors = countErrors(specIssues) > 0;

  const handleRowNavigate = () => {
    navigation.navigateToLevel(0);
  };

  return (
    <BlockStack align="stretch" className="min-w-0 w-full">
      <div
        className={treeNodeRowVariants({
          hasErrors,
          fullWidth: true,
        })}
      >
        <TreeRowActivate
          layout="rootStrip"
          onActivate={handleRowNavigate}
          trackingId="v2.pipeline_editor.pipeline_tree.root_nav"
        >
          <Text
            size="xs"
            weight="semibold"
            className={treeNodeLabelToneVariants({ tone: "none" })}
          >
            {spec.name}
          </Text>

          <IssueBadge issues={graphIssues} />
        </TreeRowActivate>
      </div>

      <div className="w-full">
        {graphIssues.length > 0 && (
          <BlockStack gap="1" className="ml-2 mt-0.5 mb-1">
            {graphIssues.map((issue, index) => (
              <IssueRow
                key={`${issue.type}-${issue.entityId ?? "graph"}-${index}`}
                issue={issue}
                issueNavigationPath={navigationPath}
              />
            ))}
          </BlockStack>
        )}

        {hasChildren && (
          <BlockStack
            gap="0"
            align="stretch"
            className="ml-2 min-w-0 w-full border-l border-slate-200"
          >
            <div className="-ml-1.5 min-w-0 w-full">
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
      </div>
    </BlockStack>
  );
});
