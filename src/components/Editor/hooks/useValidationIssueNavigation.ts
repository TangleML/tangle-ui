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

const HIGHLIGHT_DURATION_MS = 900;
const MAX_FOCUS_ATTEMPTS = 15;
const FOCUS_RETRY_INTERVAL_MS = 50;

const getIssueNodeId = (issue: ComponentValidationIssue): string | null => {
  if (issue.taskId) return taskIdToNodeId(issue.taskId);
  if (issue.inputName) return inputNameToNodeId(issue.inputName);
  if (issue.outputName) return outputNameToNodeId(issue.outputName);
  return null;
};

const formatIssueMessage = (issue: ComponentValidationIssue): string => {
  const { message } = issue;

  if (message.includes("missing required argument")) {
    const match = /input:\s*"([^"]+)"/i.exec(message);
    return `Missing argument: ${match?.[1] ?? "value"}`;
  }

  if (message.includes("is not connected to any tasks")) {
    return "Not connected to any tasks";
  }

  if (message.includes("must contain at least one task")) {
    return "Pipeline must contain at least one task";
  }

  return message;
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

  const focusAbortRef = useRef<(() => void) | null>(null);

  const focusIssue = useCallback(
    (issue: ComponentValidationIssue) => {
      const nodeId = getIssueNodeId(issue);
      if (!nodeId) return;

      const canHighlight = issue.type === "task";

      focusAbortRef.current?.();

      let cancelled = false;
      let timeoutId: ReturnType<typeof setTimeout> | null = null;
      let didHighlight = false;

      focusAbortRef.current = () => {
        cancelled = true;
        if (timeoutId) clearTimeout(timeoutId);
        if (didHighlight) {
          notifyNode(nodeId, { type: "clear" });
        }
      };

      const tryFocus = async (attemptsRemaining: number) => {
        if (cancelled) return;

        const didFit = await fitNodeIntoView(nodeId);

        if (cancelled) return;

        if (didFit) {
          if (canHighlight) {
            didHighlight = true;
            notifyNode(nodeId, { type: "highlight" });
            timeoutId = setTimeout(() => {
              if (!cancelled) {
                notifyNode(nodeId, { type: "clear" });
              }
            }, HIGHLIGHT_DURATION_MS);
          }
          return;
        }

        if (attemptsRemaining > 0) {
          timeoutId = setTimeout(() => {
            tryFocus(attemptsRemaining - 1);
          }, FOCUS_RETRY_INTERVAL_MS);
        }
      };

      void tryFocus(MAX_FOCUS_ATTEMPTS);
    },
    [fitNodeIntoView, notifyNode],
  );

  useEffect(() => {
    return () => focusAbortRef.current?.();
  }, []);

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

    focusIssue(pendingIssue);
    setPendingIssue(null);
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
        displayMessage: formatIssueMessage(issue),
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
    issueItems,
    groupedIssues,
  };
};
