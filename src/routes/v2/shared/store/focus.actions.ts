import type {
  ComponentSpec,
  ComponentValidationIssue,
  ValidationIssue,
} from "@/models/componentSpec";

import type { EditorStore, NodeEntityType } from "./editorStore";
import type { NavigationStore } from "./navigationStore";

interface ResolvedValidationEntity {
  id: string;
  type: NodeEntityType;
}

function isComponentValidationIssue(
  issue: ValidationIssue,
): issue is ComponentValidationIssue {
  return "subgraphPath" in issue && Array.isArray(issue.subgraphPath);
}

function resolveValidationEntityFromSpec(
  spec: ComponentSpec,
  key: string,
  matchBy: "name" | "id",
): ResolvedValidationEntity | undefined {
  const findIn = <T extends { name: string; $id: string }>(
    items: readonly T[],
  ): T | undefined =>
    matchBy === "name"
      ? items.find((x) => x.name === key)
      : items.find((x) => x.$id === key);

  const task = findIn(spec.tasks);
  const input = findIn(spec.inputs);
  const output = findIn(spec.outputs);
  const id = task?.$id ?? input?.$id ?? output?.$id;
  if (!id) {
    return undefined;
  }
  const type: NodeEntityType = task ? "task" : input ? "input" : "output";
  return { id, type };
}

function applyValidationIssueEditorFocus(
  editor: EditorStore,
  issue: ValidationIssue,
  resolved: ResolvedValidationEntity | undefined,
  options?: { skipHoveredEntity?: boolean },
): void {
  if (resolved) {
    editor.setPendingFocusNode(resolved.id);
    editor.selectNode(resolved.id, resolved.type, {
      entityId: resolved.id,
    });
    if (!options?.skipHoveredEntity) {
      editor.setHoveredEntity(resolved.id);
    }
  }

  if (issue.argumentName) {
    editor.setFocusedArgument(issue.argumentName);
  }
  editor.setSelectedValidationIssue(issue);
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
  const resolved =
    activeSpec && issue.entityName
      ? resolveValidationEntityFromSpec(activeSpec, issue.entityName, "name")
      : undefined;

  applyValidationIssueEditorFocus(editor, issue, resolved);
}

export function focusIssueAtNavigationPath(
  editor: EditorStore,
  navigation: NavigationStore,
  pathFromRoot: string[],
  issue: ValidationIssue,
): void {
  navigation.navigateToPath(pathFromRoot);

  const activeSpec = navigation.activeSpec;
  const resolved =
    activeSpec && issue.entityId
      ? resolveValidationEntityFromSpec(activeSpec, issue.entityId, "id")
      : undefined;

  applyValidationIssueEditorFocus(editor, issue, resolved);
}

export function focusValidationIssue(
  editor: EditorStore,
  issue: ValidationIssue,
): void {
  const resolved: ResolvedValidationEntity | undefined = issue.entityId
    ? { id: issue.entityId, type: "task" }
    : undefined;

  applyValidationIssueEditorFocus(editor, issue, resolved, {
    skipHoveredEntity: true,
  });
}
