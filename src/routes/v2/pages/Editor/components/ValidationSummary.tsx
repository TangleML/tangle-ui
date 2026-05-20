import { observer } from "mobx-react-lite";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { ListRow } from "@/components/ui/patterns/list-row";
import { Text } from "@/components/ui/typography";
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

  const summaryTone = errorCount > 0 ? "critical" : "warning";

  return (
    <BlockStack gap="1" className={className}>
      <InlineStack gap="1" blockAlign="stretch" className="w-full min-w-0">
        <Button
          variant="ghost"
          tone={summaryTone}
          size="sm"
          align="start"
          fullWidth
          className="min-w-0 h-auto py-1.5 gap-1.5"
          onClick={() => setIsExpanded((prev) => !prev)}
          {...tracking(
            "v2.pipeline_editor.configuration_panel.validation_summary_toggle",
          )}
        >
          <Icon name={isExpanded ? "ChevronDown" : "ChevronRight"} size="sm" />
          <Icon name="TriangleAlert" size="sm" />
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
            const issueTone =
              issue.severity === "error" ? "critical" : "warning";

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
              <ListRow
                key={`${issue.type}-${issue.entityId ?? "graph"}-${index}`}
                density="compact"
                gap="1"
                hoverable
                selected={isSelected}
                onClick={handleIssueClick}
              >
                <Text
                  size="xs"
                  weight="semibold"
                  tone={issueTone}
                  transform="uppercase"
                >
                  {issueTypeLabel(issue.type)}
                </Text>
                <Text size="xs" tone={issueTone}>
                  {issue.subgraphPath.length > 1 && (
                    <Text weight="medium">
                      {issue.subgraphPath.slice(1).join(" > ")}
                      {" > "}
                    </Text>
                  )}
                  {issue.message}
                </Text>
              </ListRow>
            );
          })}
        </BlockStack>
      )}
    </BlockStack>
  );
});
