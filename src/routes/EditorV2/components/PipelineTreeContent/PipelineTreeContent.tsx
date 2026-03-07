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

import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";

import {
  editorStore,
  setSelectedValidationIssue,
} from "../../store/editorStore";
import { navigationStore } from "../../store/navigationStore";
import { ValidationSummary } from "../ValidationSummary";
import { RootNode } from "./components/RootNode";
import { ValidationIssueResolutionCard } from "./components/ValidationIssueResolutionCard";
import { buildExpandedPaths, buildNavPathArray } from "./utils";

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
          <ValidationSummary
            spec={rootSpec}
            className="border-t border-slate-200 pt-2"
          />
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
