import { observer } from "mobx-react-lite";

import { Icon } from "@/components/ui/icon";
import { BlockStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import type { ComponentSpec, Task } from "@/models/componentSpec";

import {
  selectNode,
  setHoveredEntity,
  setPendingFocusNode,
  setSelectedValidationIssue,
} from "../../../store/editorStore";
import {
  navigateToPath,
  navigationStore,
} from "../../../store/navigationStore";
import { countErrors, countWarnings } from "../../ValidationSummary";
import { getEntityIssues } from "../utils";
import { IssueBadge } from "./IssueBadge";
import { IssueRow } from "./IssueRow";

interface TaskLeafNodeProps {
  task: Task;
  parentSpec: ComponentSpec;
  parentNavigationPath: string[];
}

export const TaskLeafNode = observer(function TaskLeafNode({
  task,
  parentSpec,
  parentNavigationPath,
}: TaskLeafNodeProps) {
  const issues = getEntityIssues(parentSpec, task.$id);
  const hasErrors = countErrors(issues) > 0;
  const isOnActiveCanvas = parentSpec === navigationStore.activeSpec;

  const handleClick = () => {
    navigateToPath(parentNavigationPath);
    setPendingFocusNode(task.$id);
    selectNode(task.$id, "task");
    if (issues.length > 0) {
      setSelectedValidationIssue(issues[0]);
    }
  };

  const handleMouseEnter = () => {
    if (isOnActiveCanvas) setHoveredEntity(task.$id);
  };

  const handleMouseLeave = () => {
    setHoveredEntity(null);
  };

  const hasIssues = issues.length > 0;
  const hasWarnings = countWarnings(issues) > 0;

  return (
    <BlockStack gap="0">
      <div
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={(e) => e.key === "Enter" && handleClick()}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={cn(
          "flex items-start gap-1 py-1 text-slate-600 rounded-md cursor-pointer transition-colors hover:bg-slate-100",
          hasErrors && "text-red-700",
        )}
      >
        <Icon
          name={hasIssues ? "CircleAlert" : "Circle"}
          size="xs"
          className={cn(
            "bg-white",
            "shrink-0 mt-0.5",
            hasErrors
              ? "text-red-400"
              : hasWarnings
                ? "text-amber-400"
                : "text-slate-400",
          )}
        />
        <Text size="sm" className="break-words min-w-0 flex-1">
          {task.name}
        </Text>
        <IssueBadge issues={issues} />
      </div>
      {hasIssues && (
        <BlockStack gap="1" className="ml-10 mb-1">
          {issues.map((issue, index) => (
            <IssueRow
              key={`${issue.type}-${issue.entityId ?? "graph"}-${index}`}
              issue={issue}
            />
          ))}
        </BlockStack>
      )}
    </BlockStack>
  );
});
