import { observer } from "mobx-react-lite";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import type { ComponentSpec, ValidationIssue } from "@/models/componentSpec";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

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
  const [isExpanded, setIsExpanded] = useState(false);
  const { editor, navigation } = useSharedStores();
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

  return (
    <BlockStack gap="1" className={className}>
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          "w-full justify-start gap-1.5 h-auto py-1.5",
          errorCount > 0
            ? "text-red-700 hover:bg-red-50"
            : "text-amber-700 hover:bg-amber-50",
        )}
        onClick={() => setIsExpanded((prev) => !prev)}
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

      {isExpanded && (
        <BlockStack gap="1" className="pl-2">
          {issues.map((issue, index) => {
            const isSelected = editor.selectedValidationIssue === issue;

            const handleIssueClick = () => {
              if (issue.subgraphPath.length > 1 && navigation.rootSpec) {
                const navPath = [
                  navigation.rootSpec.name,
                  ...issue.subgraphPath.slice(1),
                ];
                navigation.navigateToPath(navPath);
              } else {
                navigation.navigateToLevel(0);
              }

              // The issue's entityId comes from validation's own deserialization,
              // so it won't match the navigation spec's IDs. Look up by name instead.
              const activeSpec = navigation.activeSpec;
              if (activeSpec && issue.entityName) {
                const task = activeSpec.tasks.find(
                  (t) => t.name === issue.entityName,
                );
                const input = activeSpec.inputs.find(
                  (i) => i.name === issue.entityName,
                );
                const output = activeSpec.outputs.find(
                  (o) => o.name === issue.entityName,
                );
                const resolvedId = task?.$id ?? input?.$id ?? output?.$id;
                if (resolvedId) {
                  const resolvedType = task
                    ? "task"
                    : input
                      ? "input"
                      : "output";
                  editor.setPendingFocusNode(resolvedId);
                  editor.selectNode(resolvedId, resolvedType, {
                    entityId: resolvedId,
                  });
                  editor.setHoveredEntity(resolvedId);
                }
              }

              if (issue.argumentName) {
                editor.setFocusedArgument(issue.argumentName);
              }
              editor.setSelectedValidationIssue(issue);
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
