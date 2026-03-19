import type { ValidationIssue } from "@/models/componentSpec";

import type { EditorStore, NodeEntityType } from "./editorStore";
import type { NavigationStore } from "./navigationStore";

export function navigateToEntity(
  editor: EditorStore,
  navigation: NavigationStore,
  path: string[],
  entityId: string,
  entityType: NodeEntityType,
): void {
  navigation.navigateToPath(path);
  editor.setPendingFocusNode(entityId);
  editor.selectNode(entityId, entityType);
}

export function focusValidationIssue(
  editor: EditorStore,
  issue: ValidationIssue,
): void {
  if (issue.entityId) {
    editor.setPendingFocusNode(issue.entityId);
    editor.selectNode(issue.entityId, "task", { entityId: issue.entityId });
  }
  if (issue.argumentName) {
    editor.setFocusedArgument(issue.argumentName);
  }
  editor.setSelectedValidationIssue(issue);
}
