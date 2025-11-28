import { useState } from "react";

import { InfoBox } from "@/components/shared/InfoBox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Icon } from "@/components/ui/icon";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { ComponentValidationIssue } from "@/utils/validations";

import type { ValidationIssueGroup } from "../../hooks/useValidationIssueNavigation";

interface PipelineValidationListProps {
  isComponentTreeValid: boolean;
  groupedIssues: ValidationIssueGroup[];
  totalIssueCount: number;
  onIssueSelect: (issue: ComponentValidationIssue) => void;
}

const scrollAreaStyles = [
  "mt-3 overflow-hidden pr-4",
  "**:data-[slot=scroll-area-viewport]:max-h-80",
  "**:data-[slot=scroll-area-scrollbar]:mx-1",
  "**:data-[slot=scroll-area-scrollbar]:w-2",
  "**:data-[slot=scroll-area-scrollbar]:opacity-80",
  "**:data-[slot=scroll-area-scrollbar]:transition-opacity",
  "**:data-[slot=scroll-area-thumb]:bg-destructive/30",
  "**:data-[slot=scroll-area-thumb]:hover:bg-destructive/50",
].join(" ");

const issueButtonStyles = [
  "w-full cursor-pointer rounded-lg border border-destructive/20 bg-white/80",
  "px-3 py-2 text-left shadow-sm transition",
  "hover:border-destructive/40 hover:bg-destructive/5",
  "focus-visible:outline-none focus-visible:ring-2",
  "focus-visible:ring-destructive/40 focus-visible:ring-offset-1",
].join(" ");

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
    <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-3">
      <div className="flex items-center gap-2 text-destructive-foreground">
        <Icon name="TriangleAlert" size="sm" className="text-destructive" />
        <div className="flex flex-col">
          <p className="text-sm font-semibold">
            {totalIssueCount} issue{totalIssueCount === 1 ? "" : "s"} detected
          </p>
          <p className="text-xs text-destructive-foreground/80">
            Select an item to jump to its location in the pipeline.
          </p>
        </div>
      </div>

      <ScrollArea className={scrollAreaStyles}>
        <div className="flex flex-col gap-2">
          {groupedIssues.map((group) => {
            const isOpen = openGroups.has(group.pathKey);
            return (
              <Collapsible
                key={group.pathKey}
                open={isOpen}
                onOpenChange={() => toggleGroup(group.pathKey)}
              >
                <Tooltip>
                  <TooltipTrigger asChild>
                    <CollapsibleTrigger className="flex w-full cursor-pointer items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-left text-sm font-medium text-destructive-foreground transition hover:bg-destructive/15">
                      <Icon
                        name="ChevronRight"
                        size="sm"
                        className={cn(
                          "text-destructive/60 transition-transform duration-200",
                          isOpen && "rotate-90",
                        )}
                      />
                      <span className="flex-1 truncate">
                        {group.depth === 0 && "Root Pipeline"}
                        {group.depth > 0 && (
                          <>
                            <span className="font-bold">Subgraph: </span>
                            {group.pathLabel}
                          </>
                        )}
                      </span>
                      <span className="rounded-full bg-destructive/20 px-2 py-0.5 text-xs font-semibold text-destructive">
                        {group.issues.length}
                      </span>
                    </CollapsibleTrigger>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={4}>
                    {group.fullPath}
                  </TooltipContent>
                </Tooltip>

                <CollapsibleContent className="mt-1 flex flex-col gap-1 pl-4">
                  {group.issues.map(
                    ({ issue, displayName, typeLabel, displayMessage }) => (
                      <button
                        key={issue.id}
                        type="button"
                        onClick={() => onIssueSelect(issue)}
                        className={issueButtonStyles}
                      >
                        <div className="flex items-center gap-2 text-[0.65rem] font-semibold uppercase tracking-wide text-destructive">
                          <span>{typeLabel}</span>
                          <span className="text-destructive/40">•</span>
                          <span className="truncate text-muted-foreground normal-case">
                            {displayName}
                          </span>
                        </div>
                        <div className="mt-1 text-sm">{displayMessage}</div>
                      </button>
                    ),
                  )}
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
};
