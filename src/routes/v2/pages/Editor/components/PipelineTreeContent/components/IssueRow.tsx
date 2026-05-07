import { observer } from "mobx-react-lite";

import { Text } from "@/components/ui/typography";
import type { ValidationIssue } from "@/models/componentSpec";
import { issueTypeLabel } from "@/routes/v2/pages/Editor/components/ValidationSummary";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";
import { useFocusActions } from "@/routes/v2/shared/store/useFocusActions";

import {
  issueRowMessageVariants,
  type IssueRowSeverity,
  issueRowTypeLabelVariants,
  issueRowVariants,
} from "./issueRow.variants";

interface IssueRowProps {
  issue: ValidationIssue;
}

export const IssueRow = observer(function IssueRow({ issue }: IssueRowProps) {
  const { editor } = useSharedStores();
  const { focusValidationIssue } = useFocusActions();
  const isSelected = editor.selectedValidationIssue === issue;
  const severity: IssueRowSeverity =
    issue.severity === "error" ? "error" : "warning";

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    focusValidationIssue(issue);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) =>
        e.key === "Enter" && handleClick(e as unknown as React.MouseEvent)
      }
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
