import { observer } from "mobx-react-lite";

import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import type { ValidationIssue } from "@/models/componentSpec";
import { issueTypeLabel } from "@/routes/EditorV2/components/ValidationSummary";
import {
  editorStore,
  selectNode,
  setFocusedArgument,
  setPendingFocusNode,
  setSelectedValidationIssue,
} from "@/routes/EditorV2/store/editorStore";

interface IssueRowProps {
  issue: ValidationIssue;
}

export const IssueRow = observer(function IssueRow({ issue }: IssueRowProps) {
  const isSelected = editorStore.selectedValidationIssue === issue;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (issue.entityId) {
      setPendingFocusNode(issue.entityId);
      selectNode(issue.entityId, "task", { entityId: issue.entityId });
    }
    if (issue.argumentName) {
      setFocusedArgument(issue.argumentName);
    }
    setSelectedValidationIssue(issue);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) =>
        e.key === "Enter" && handleClick(e as unknown as React.MouseEvent)
      }
      className={cn(
        "flex items-baseline gap-1 py-0.5 px-2 rounded text-xs cursor-pointer transition-colors",
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
          issue.severity === "error" ? "text-red-600" : "text-amber-600",
        )}
      >
        {issueTypeLabel(issue.type)}
      </Text>
      <Text
        size="xs"
        className={
          issue.severity === "error" ? "text-red-700" : "text-amber-700"
        }
      >
        {issue.message}
      </Text>
    </div>
  );
});
