import { observer } from "mobx-react-lite";
import type { KeyboardEvent, MouseEvent } from "react";

import { Text } from "@/components/ui/typography";
import type { ValidationIssue } from "@/models/componentSpec";
import { issueTypeLabel } from "@/routes/v2/pages/Editor/components/ValidationSummary";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";
import { useFocusActions } from "@/routes/v2/shared/store/useFocusActions";
import { tracking } from "@/utils/tracking";

import {
  issueRowMessageVariants,
  type IssueRowSeverity,
  issueRowTypeLabelVariants,
  issueRowVariants,
} from "./issueRow.variants";

interface IssueRowProps {
  issue: ValidationIssue;
  issueNavigationPath: string[];
}

export const IssueRow = observer(function IssueRow({
  issue,
  issueNavigationPath,
}: IssueRowProps) {
  const { editor } = useSharedStores();
  const { focusIssueAtNavigationPath } = useFocusActions();
  const isSelected = editor.selectedValidationIssue === issue;
  const severity: IssueRowSeverity =
    issue.severity === "error" ? "error" : "warning";

  const handleSelectIssue = () => {
    focusIssueAtNavigationPath(issueNavigationPath, issue);
  };

  const handleClick = (e: MouseEvent) => {
    e.stopPropagation();
    handleSelectIssue();
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key !== "Enter" && e.key !== " ") {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    handleSelectIssue();
  };

  return (
    <div
      role="button"
      tabIndex={0}
      {...tracking("v2.pipeline_editor.pipeline_tree.validation_issue_select")}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={issueRowVariants({
        selected: isSelected,
        severity,
      })}
    >
      <Text
        size="xs"
        weight="semibold"
        className={issueRowTypeLabelVariants({ severity })}
      >
        {issueTypeLabel(issue.type)}
      </Text>
      <Text size="xs" className={issueRowMessageVariants({ severity })}>
        {issue.message}
      </Text>
    </div>
  );
});
