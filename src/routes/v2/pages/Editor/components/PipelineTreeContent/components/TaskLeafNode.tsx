import { observer } from "mobx-react-lite";

import { Icon } from "@/components/ui/icon";
import { BlockStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import type { ComponentSpec, Task } from "@/models/componentSpec";
import { getEntityIssues } from "@/routes/v2/pages/Editor/components/PipelineTreeContent/utils";
import {
  countErrors,
  countWarnings,
} from "@/routes/v2/pages/Editor/components/ValidationSummary";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";
import { useFocusActions } from "@/routes/v2/shared/store/useFocusActions";

import { IssueBadge } from "./IssueBadge";
import { IssueRow } from "./IssueRow";
import {
  type TreeNodeLabelTone,
  treeNodeLabelToneVariants,
  treeNodeLeafIconToneVariants,
} from "./treeNode.variants";
import { TreeRowActivate } from "./TreeRowActivate";

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
  const { editor } = useSharedStores();
  const { navigateToEntity, focusValidationIssue } = useFocusActions();
  const issues = getEntityIssues(parentSpec, task.$id);
  const hasErrors = countErrors(issues) > 0;
  const isSelected = editor.isTaskSelected(task.$id);

  const handleClick = () => {
    navigateToEntity(parentNavigationPath, task.$id, "task");
    if (issues.length > 0) {
      focusValidationIssue(issues[0]);
    }
  };

  const hasIssues = issues.length > 0;
  const hasWarnings = countWarnings(issues) > 0;

  let iconTone: TreeNodeLabelTone = "none";
  if (hasErrors) {
    iconTone = "error";
  } else if (hasWarnings) {
    iconTone = "warning";
  }

  return (
    <BlockStack gap="0" align="stretch" className="min-w-0 w-full">
      <TreeRowActivate
        layout="leafRow"
        selected={isSelected}
        taskId={task.$id}
        onActivate={handleClick}
        trackingId="v2.pipeline_editor.pipeline_tree.task_nav"
      >
        <Icon
          name={hasIssues ? "CircleAlert" : "Circle"}
          size="xs"
          className={treeNodeLeafIconToneVariants({
            tone: iconTone,
            selected: isSelected,
          })}
        />
        <Text size="xs" className={treeNodeLabelToneVariants({ tone: "none" })}>
          {task.name}
        </Text>
        <IssueBadge issues={issues} />
      </TreeRowActivate>
      {hasIssues && (
        <BlockStack gap="1" className="ml-3 mb-1">
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
