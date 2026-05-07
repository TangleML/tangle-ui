import type {
  ComponentValidationIssue,
  ValidationIssue,
} from "@/models/componentSpec";

import type { EditorStore, NodeEntityType } from "./editorStore";
import type { NavigationStore } from "./navigationStore";

function isComponentValidationIssue(
  issue: ValidationIssue,
): issue is ComponentValidationIssue {
  return "subgraphPath" in issue && Array.isArray(issue.subgraphPath);
}

export function sameValidationIssue(
  a: ValidationIssue,
  b: ValidationIssue,
): boolean {
  return (
    a.issueCode === b.issueCode &&
    a.entityId === b.entityId &&
    a.argumentName === b.argumentName
  );
}

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

export function navigateAndSelectIssue(
  editor: EditorStore,
  navigation: NavigationStore,
  issue: ValidationIssue,
): void {
  if (!isComponentValidationIssue(issue)) {
    focusValidationIssue(editor, issue);
    return;
  }

  if (issue.subgraphPath.length > 1 && navigation.rootSpec) {
    const navPath = [navigation.rootSpec.name, ...issue.subgraphPath.slice(1)];
    navigation.navigateToPath(navPath);
  } else {
    navigation.navigateToLevel(0);
  }

  // The issue's entityId comes from validation's own deserialization,
  // so it won't match the navigation spec's IDs. Look up by name instead.
  const activeSpec = navigation.activeSpec;
  if (activeSpec && issue.entityName) {
    const task = activeSpec.tasks.find((t) => t.name === issue.entityName);
    const input = activeSpec.inputs.find((i) => i.name === issue.entityName);
    const output = activeSpec.outputs.find((o) => o.name === issue.entityName);
    const resolvedId = task?.$id ?? input?.$id ?? output?.$id;
    if (resolvedId) {
      const resolvedType = task ? "task" : input ? "input" : "output";
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
