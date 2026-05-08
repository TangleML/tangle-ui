import { observer } from "mobx-react-lite";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import type { ComponentSpec, ValidationIssue } from "@/models/componentSpec";
import { useAnalytics } from "@/providers/AnalyticsProvider";
import { useIssueResolutionWindow } from "@/routes/v2/pages/Editor/components/IssueResolution/useIssueResolutionWindow";
import {
  navigateAndSelectIssue,
  sameValidationIssue,
} from "@/routes/v2/shared/store/focus.actions";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";
import { tracking } from "@/utils/tracking";

export function countErrors(issues: ValidationIssue[]): number {
  return issues.filter((i) => i.severity === "error").length;
}

export function countWarnings(issues: ValidationIssue[]): number {
  return issues.filter((i) => i.severity === "warning").length;
}

export function issueTypeLabel(type: string): string {
  switch (type) {
    case "graph":
      return "PIPELINE";
    case "task":
      return "TASK";
    case "input":
      return "INPUT";
    case "output":
      return "OUTPUT";
    default:
      return type.toUpperCase();
  }
}

interface ValidationSummaryProps {
  spec: ComponentSpec;
  className?: string;
}

export const ValidationSummary = observer(function ValidationSummary({
  spec,
  className,
}: ValidationSummaryProps) {
  const { track } = useAnalytics();
  const [isExpanded, setIsExpanded] = useState(false);
  const { editor, navigation } = useSharedStores();
  const openIssueResolutionWindow = useIssueResolutionWindow();
  const issues = spec.allValidationIssues;
  const errorCount = countErrors(issues);
  const warningCount = countWarnings(issues);
  const totalCount = issues.length;

  if (totalCount === 0) return null;

  const summaryParts: string[] = [];
  if (errorCount > 0)
    summaryParts.push(`${errorCount} error${errorCount > 1 ? "s" : ""}`);
  if (warningCount > 0)
    summaryParts.push(`${warningCount} warning${warningCount > 1 ? "s" : ""}`);

  const selectedIssue = editor.selectedValidationIssue;

  const handleOpenFixWindow = () => {
    const sel = editor.selectedValidationIssue;
    if (!sel || !issues.some((i) => sameValidationIssue(i, sel))) {
      navigateAndSelectIssue(editor, navigation, issues[0]);
    }
    openIssueResolutionWindow();
  };

  return (
    <BlockStack gap="1" className={className}>
      <InlineStack gap="1" blockAlign="stretch" className="w-full min-w-0">
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "min-w-0 flex-1 justify-start gap-1.5 h-auto py-1.5",
            errorCount > 0
              ? "text-red-700 hover:bg-red-50"
              : "text-amber-700 hover:bg-amber-50",
          )}
          onClick={() => setIsExpanded((prev) => !prev)}
          {...tracking(
            "v2.pipeline_editor.configuration_panel.validation_summary_toggle",
          )}
        >
          <Icon
            name={isExpanded ? "ChevronDown" : "ChevronRight"}
            size="sm"
            className="shrink-0"
          />
          <Icon name="TriangleAlert" size="sm" className="shrink-0" />
          <Text size="sm" weight="semibold">
            {summaryParts.join(", ")}
          </Text>
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0 h-auto py-1.5"
          onClick={handleOpenFixWindow}
          data-testid="validation-summary-fix-button"
        >
          Fix
        </Button>
      </InlineStack>

      {isExpanded && (
        <BlockStack gap="1" className="pl-2">
          {issues.map((issue, index) => {
            const isSelected =
              selectedIssue !== null &&
              sameValidationIssue(selectedIssue, issue);

            const handleIssueClick = () => {
              track(
                "v2.pipeline_editor.configuration_panel.validation_issue.click",
                {
                  issue_type: issue.type,
                  severity: issue.severity,
                },
              );
              navigateAndSelectIssue(editor, navigation, issue);
            };

            return (
              <div
                key={`${issue.type}-${issue.entityId ?? "graph"}-${index}`}
                role="button"
                tabIndex={0}
                onClick={handleIssueClick}
                onKeyDown={(e) =>
                  (e.key === "Enter" || e.key === " ") && handleIssueClick()
                }
                className={cn(
                  "flex items-baseline gap-1 py-1 px-2 rounded text-xs cursor-pointer transition-colors",
                  isSelected ? "ring-1 ring-blue-400" : "",
                  issue.severity === "error"
                    ? "bg-red-50 text-red-800 hover:bg-red-100"
                    : "bg-amber-50 text-amber-800 hover:bg-amber-100",
                )}
              >
                <Text
                  size="xs"
                  weight="semibold"
                  className={cn(
                    "shrink-0 uppercase tracking-wide",
                    issue.severity === "error"
                      ? "text-red-600"
                      : "text-amber-600",
                  )}
                >
                  {issueTypeLabel(issue.type)}
                </Text>
                <Text
                  size="xs"
                  className={
                    issue.severity === "error"
                      ? "text-red-700"
                      : "text-amber-700"
                  }
                >
                  {issue.subgraphPath.length > 1 && (
                    <span className="font-medium">
                      {issue.subgraphPath.slice(1).join(" > ")}
                      {" > "}
                    </span>
                  )}
                  {issue.message}
                </Text>
              </div>
            );
          })}
        </BlockStack>
      )}
    </BlockStack>
  );
});
