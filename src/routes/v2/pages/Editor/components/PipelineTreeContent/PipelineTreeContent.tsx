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

import { BlockStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

import { RootNode } from "./components/RootNode";
import { buildExpandedPaths, buildNavPathArray } from "./utils";

export const PipelineTreeContent = observer(function PipelineTreeContent() {
  const { navigation } = useSharedStores();
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
      className="min-w-0 h-full"
      data-testid="pipeline-tree-content"
      gap="2"
      align="stretch"
    >
      <BlockStack
        className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto p-2 hide-scrollbar"
        gap="2"
        align="stretch"
      >
        <RootNode
          spec={rootSpec}
          currentNavPath={currentNavPath}
          expandedNodes={expandedNodes}
          onToggleExpand={handleToggleExpand}
        />
      </BlockStack>
    </BlockStack>
  );
});
