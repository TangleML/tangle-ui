/**
 * PipelineTreeContent - displays a tree view of the pipeline structure.
 *
 * Shows the hierarchical structure of the pipeline including all tasks.
 * Subgraph tasks are clickable and can be navigated into.
 * Regular tasks are displayed but not clickable.
 * Highlights the navigation path via label weight on root and subgraph rows; expansion follows the navigation path.
 * Displays validation error badges per entity.
 */

import { observer } from "mobx-react-lite";
import { useEffect, useState } from "react";

import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

import { RootNode } from "./components/RootNode";
import { ValidationIssueResolutionCard } from "./components/ValidationIssueResolutionCard";
import { buildExpandedPaths, buildNavPathArray } from "./utils";

export const PipelineTreeContent = observer(function PipelineTreeContent() {
  const { editor, navigation } = useSharedStores();
  const rootSpec = navigation.rootSpec;
  const { navigationPath } = navigation;
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

  const selectedIssue = editor.selectedValidationIssue;

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
      editor.setSelectedValidationIssue(null);
    }
  }, [issueStillExists, selectedIssue]);

  const activeIssue = issueStillExists ? selectedIssue : null;

  if (!rootSpec) {
    return (
      <BlockStack className="p-4">
        <Text size="xs" tone="subdued">
          No pipeline loaded
        </Text>
      </BlockStack>
    );
  }

  return (
    <BlockStack
      className="@container min-w-0 h-full"
      data-testid="pipeline-tree-content"
    >
      <InlineStack
        className="h-full min-w-0 flex-col @[600px]:grid @[600px]:grid-cols-[minmax(0,40%)_minmax(0,60%)] @[600px]:items-start"
        fill
        data-testid="pipeline-tree-content-container"
      >
        <BlockStack
          gap="2"
          align="stretch"
          className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto p-2 hide-scrollbar @[600px]:border-r @[600px]:border-border"
        >
          <RootNode
            spec={rootSpec}
            currentNavPath={currentNavPath}
            expandedNodes={expandedNodes}
            onToggleExpand={handleToggleExpand}
          />
        </BlockStack>
        <BlockStack className="hidden min-h-0 min-w-0 max-w-md overflow-y-auto @[600px]:flex">
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
