import { useState } from "react";

import { InfoBox } from "@/components/shared/InfoBox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Paragraph, Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import { pluralize } from "@/utils/string";
import {
  type ComponentValidationIssue,
  isFixableIssue,
} from "@/utils/validations";

import type { ValidationIssueGroup } from "../hooks/useValidationIssueNavigation";

interface PipelineValidationListProps {
  groupedIssues: ValidationIssueGroup[];
  globalValidationIssues: ComponentValidationIssue[];
  onIssueSelect: (issue: ComponentValidationIssue) => void;
}

const levelToTone = (
  level: ValidationIssueGroup["issues"][number]["level"],
): "critical" | "warning" => {
  if (level === "error") {
    return "critical";
  }
  return "warning";
};

const isGroupWarningOnly = (group: ValidationIssueGroup): boolean => {
  return group.issues.every((issue) => issue.level === "warning");
};

const groupTriggerWarningStyles = cn(
  "w-full justify-start gap-2 rounded-lg font-medium",
  "bg-warning/10 text-warning-foreground hover:bg-warning/15",
);

const groupTriggerErrorStyles = cn(
  "w-full justify-start gap-2 rounded-lg font-medium",
  "bg-destructive/10 text-destructive-foreground hover:bg-destructive/15",
);

const warningButtonStyles = cn(
  "h-auto w-full flex-col items-start justify-start gap-1 rounded-lg",
  "whitespace-normal border-warning/20 bg-warning/5 px-3 py-2 text-left",
  "hover:border-warning/80 hover:bg-warning/15",
  "focus-visible:ring-warning/40",
);

const errorButtonStyles = cn(
  "h-auto w-full flex-col items-start justify-start gap-1 rounded-lg",
  "whitespace-normal border-destructive/20 bg-destructive/5 px-3 py-2 text-left",
  "hover:border-destructive/40 hover:bg-destructive/10",
  "focus-visible:ring-destructive/40",
);

export const PipelineValidationList = ({
  globalValidationIssues,
  groupedIssues,
  onIssueSelect,
}: PipelineValidationListProps) => {
  const totalIssueCount = globalValidationIssues.length;
  const fixableIssueCount =
    globalValidationIssues.filter(isFixableIssue).length;
  const nonFixableIssueCount = totalIssueCount - fixableIssueCount;

  const isValid = totalIssueCount === 0;

  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());

  const toggleGroup = (pathKey: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(pathKey)) {
        next.delete(pathKey);
      } else {
        next.add(pathKey);
      }
      return next;
    });
  };

  if (isValid) {
    return (
      <InfoBox variant="success" title="No validation issues found">
        Pipeline is ready for submission
      </InfoBox>
    );
  }

  const errorTitle =
    nonFixableIssueCount > 0
      ? `${nonFixableIssueCount} ${pluralize(nonFixableIssueCount, "error")}`
      : "";
  const warningTitle =
    fixableIssueCount > 0
      ? `${fixableIssueCount} ${pluralize(fixableIssueCount, "warning")}`
      : "";
  const totalIssuesTitle = [errorTitle, warningTitle]
    .filter(Boolean)
    .join(" and ");

  return (
    <InfoBox
      variant={nonFixableIssueCount > 0 ? "error" : "warning"}
      title={`${totalIssuesTitle} detected`}
    >
      <Paragraph size="sm" className="mb-4">
        Select an item to jump to its location in the pipeline.
      </Paragraph>

      <BlockStack gap="2">
        {groupedIssues.map((group) => {
          const isOpen = openGroups.has(group.pathKey);
          const isWarningOnly = isGroupWarningOnly(group);

          return (
            <Collapsible
              key={group.pathKey}
              open={isOpen}
              onOpenChange={() => toggleGroup(group.pathKey)}
              className="w-full"
              data-testid="validation-group"
            >
              <Tooltip>
                <TooltipTrigger asChild className="w-full">
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      data-testid="validation-group-trigger"
                      className={
                        isWarningOnly
                          ? groupTriggerWarningStyles
                          : groupTriggerErrorStyles
                      }
                    >
                      <Icon
                        name="ChevronRight"
                        size="sm"
                        className={cn(
                          "text-destructive/60 transition-transform duration-200",
                          isOpen && "rotate-90",
                        )}
                      />
                      <Text className="flex-1 truncate">
                        {group.depth === 0
                          ? "Root Pipeline"
                          : `Subgraph: ${group.pathLabel}`}
                      </Text>
                      <Badge
                        size="sm"
                        shape="rounded"
                        variant={isWarningOnly ? "outline" : "destructive"}
                      >
                        {group.issues.length}
                      </Badge>
                    </Button>
                  </CollapsibleTrigger>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={4}>
                  {group.fullPath}
                </TooltipContent>
              </Tooltip>

              <CollapsibleContent>
                <BlockStack gap="1" className="mt-1 pl-2">
                  {group.issues.map(
                    ({
                      issue,
                      displayName,
                      typeLabel,
                      displayMessage,
                      level,
                    }) => (
                      <Button
                        key={issue.id}
                        variant="outline"
                        onClick={() => onIssueSelect(issue)}
                        data-testid="validation-issue"
                        data-issue-level={level}
                        className={
                          level === "error"
                            ? errorButtonStyles
                            : warningButtonStyles
                        }
                      >
                        <InlineStack gap="1" wrap="nowrap">
                          <Text
                            size="xs"
                            weight="semibold"
                            tone={levelToTone(level)}
                            className="shrink-0 uppercase tracking-wide"
                          >
                            {typeLabel}
                          </Text>
                          <Text
                            tone={levelToTone(level)}
                            className="shrink-0 opacity-40"
                          >
                            •
                          </Text>
                          <Text
                            size="xs"
                            tone={levelToTone(level)}
                            className="truncate"
                          >
                            {displayName}
                          </Text>
                        </InlineStack>
                        <Text as="p" size="sm">
                          {displayMessage}
                        </Text>
                      </Button>
                    ),
                  )}
                </BlockStack>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </BlockStack>
    </InfoBox>
  );
};
