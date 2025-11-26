import equal from "fast-deep-equal";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useNodesOverlay } from "@/components/shared/ReactFlow/NodesOverlay/NodesOverlayProvider";
import { useComponentSpec } from "@/providers/ComponentSpecProvider";
import {
  inputNameToNodeId,
  outputNameToNodeId,
  taskIdToNodeId,
} from "@/utils/nodes/nodeIdUtils";
import type { ComponentValidationIssue } from "@/utils/validations";

const ISSUE_TYPE_LABELS: Record<ComponentValidationIssue["type"], string> = {
  graph: "Graph",
  task: "Task",
  input: "Input",
  output: "Output",
};

const getIssueNodeId = (issue: ComponentValidationIssue): string | null => {
  if (issue.taskId) return taskIdToNodeId(issue.taskId);
  if (issue.inputName) return inputNameToNodeId(issue.inputName);
  if (issue.outputName) return outputNameToNodeId(issue.outputName);
  return null;
};

interface ValidationIssueListItem {
  issue: ComponentValidationIssue;
  displayName: string;
  displayMessage: string;
  typeLabel: string;
}

export interface ValidationIssueGroup {
  pathKey: string;
  pathLabel: string;
  fullPath: string;
  depth: number;
  issues: ValidationIssueListItem[];
}

export const useValidationIssueNavigation = (
  validationIssues: ComponentValidationIssue[],
) => {
  const { currentSubgraphPath, navigateToPath } = useComponentSpec();
  const { fitNodeIntoView, notifyNode } = useNodesOverlay();

  const [pendingIssue, setPendingIssue] =
    useState<ComponentValidationIssue | null>(null);

  const highlightedNodeRef = useRef<string | null>(null);

  const focusIssue = useCallback(
    async (issue: ComponentValidationIssue) => {
      const nodeId = getIssueNodeId(issue);
      if (!nodeId) return;

      // Clear previous highlight
      if (highlightedNodeRef.current && highlightedNodeRef.current !== nodeId) {
        notifyNode(highlightedNodeRef.current, { type: "clear" });
      }

      await fitNodeIntoView(nodeId);

      if (issue.type === "task") {
        highlightedNodeRef.current = nodeId;
        notifyNode(nodeId, { type: "highlight" });
      } else {
        highlightedNodeRef.current = null;
      }
    },
    [fitNodeIntoView, notifyNode],
  );

  useEffect(() => {
    return () => {
      if (highlightedNodeRef.current) {
        notifyNode(highlightedNodeRef.current, { type: "clear" });
      }
    };
  }, [notifyNode]);

  const handleIssueClick = useCallback(
    (issue: ComponentValidationIssue) => {
      if (!equal(issue.subgraphPath, currentSubgraphPath)) {
        setPendingIssue(issue);
        navigateToPath(issue.subgraphPath);
        return;
      }

      focusIssue(issue);
    },
    [currentSubgraphPath, focusIssue, navigateToPath],
  );

  useEffect(() => {
    if (!pendingIssue) return;
    if (!equal(pendingIssue.subgraphPath, currentSubgraphPath)) return;

    const frameId = requestAnimationFrame(() => {
      focusIssue(pendingIssue);
      setPendingIssue(null);
    });

    return () => cancelAnimationFrame(frameId);
  }, [currentSubgraphPath, focusIssue, pendingIssue]);

  const issueItems = useMemo<ValidationIssueListItem[]>(() => {
    return validationIssues.map((issue) => {
      const nodeLabel =
        issue.taskId ?? issue.inputName ?? issue.outputName ?? null;
      const fallbackName =
        issue.subgraphPath.length <= 1
          ? "Pipeline"
          : (issue.subgraphPath[issue.subgraphPath.length - 1] ?? "Pipeline");
      const displayName = nodeLabel ?? fallbackName;

      return {
        issue,
        displayName,
        typeLabel: ISSUE_TYPE_LABELS[issue.type],
        displayMessage: issue.message,
      };
    });
  }, [validationIssues]);

  const groupedIssues = useMemo<ValidationIssueGroup[]>(() => {
    const groupsMap = issueItems.reduce((acc, item) => {
      const pathKey = item.issue.subgraphPath.join(" > ");
      const existing = acc.get(pathKey);
      if (existing) {
        return acc.set(pathKey, [...existing, item]);
      }
      return acc.set(pathKey, [item]);
    }, new Map<string, ValidationIssueListItem[]>());

    return Array.from(groupsMap.entries())
      .map(([pathKey, items]) => {
        const { subgraphPath } = items[0].issue;
        const depth = subgraphPath.length - 1;
        const isRoot = depth === 0;

        const taskId = subgraphPath[subgraphPath.length - 1] ?? "Subgraph";

        return {
          pathKey,
          pathLabel: isRoot ? "Root Pipeline" : taskId,
          fullPath: isRoot
            ? "Root Pipeline"
            : subgraphPath.slice(1).join(" → "),
          depth,
          issues: items,
        };
      })
      .sort((a, b) => a.depth - b.depth);
  }, [issueItems]);

  return {
    handleIssueClick,
    groupedIssues,
  };
};
