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
import type { ComponentValidationIssue } from "@/utils/validations";

import type { ValidationIssueGroup } from "../../hooks/useValidationIssueNavigation";

interface PipelineValidationListProps {
  isComponentTreeValid: boolean;
  groupedIssues: ValidationIssueGroup[];
  totalIssueCount: number;
  onIssueSelect: (issue: ComponentValidationIssue) => void;
}

const groupTriggerStyles = cn(
  "w-full justify-start gap-2 rounded-lg font-medium",
  "bg-destructive/10 text-destructive-foreground hover:bg-destructive/15",
);

const issueButtonStyles = cn(
  "h-auto w-full flex-col items-start justify-start gap-1 rounded-lg",
  "whitespace-normal border-destructive/20 bg-white/80 px-3 py-2 text-left",
  "hover:border-destructive/40 hover:bg-destructive/5",
  "focus-visible:ring-destructive/40",
);

export const PipelineValidationList = ({
  isComponentTreeValid,
  groupedIssues,
  totalIssueCount,
  onIssueSelect,
}: PipelineValidationListProps) => {
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

  if (isComponentTreeValid) {
    return (
      <InfoBox variant="success" title="No validation issues found">
        Pipeline is ready for submission
      </InfoBox>
    );
  }

  return (
    <InfoBox
      variant="error"
      title={`${totalIssueCount} ${pluralize(totalIssueCount, "issue")} detected`}
    >
      <Paragraph size="sm" className="mb-4">
        {" "}
        Select an item to jump to its location in the pipeline.
      </Paragraph>

      <BlockStack gap="2">
        {groupedIssues.map((group) => {
          const isOpen = openGroups.has(group.pathKey);
          return (
            <Collapsible
              key={group.pathKey}
              open={isOpen}
              onOpenChange={() => toggleGroup(group.pathKey)}
              className="w-full"
            >
              <Tooltip>
                <TooltipTrigger asChild className="w-full">
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" className={groupTriggerStyles}>
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
                        className="rounded-full bg-destructive/20 text-destructive"
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
                    ({ issue, displayName, typeLabel, displayMessage }) => (
                      <Button
                        key={issue.id}
                        variant="outline"
                        onClick={() => onIssueSelect(issue)}
                        className={issueButtonStyles}
                      >
                        <InlineStack gap="1" blockAlign="center" wrap="nowrap">
                          <Text
                            size="xs"
                            weight="semibold"
                            tone="critical"
                            className="shrink-0 uppercase tracking-wide"
                          >
                            {typeLabel}
                          </Text>
                          <Text tone="critical" className="shrink-0 opacity-40">
                            •
                          </Text>
                          <Text size="xs" tone="subdued" className="truncate">
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
