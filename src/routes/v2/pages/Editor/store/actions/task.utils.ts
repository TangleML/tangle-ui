import type {
  ComponentSpecJson,
  InputSpec,
  ValidationIssue,
} from "@/models/componentSpec";
import type { OutputSpec } from "@/models/componentSpec/entities/types";
import { isInputRequired } from "@/models/componentSpec/validation/validateSpec";

import type { LostBinding } from "../../components/UpgradeComponents/types";

export interface EntityDiff<T> {
  lostEntities: T[];
  newEntities: T[];
  changedEntities: T[];
}

interface ComponentSpecDiff {
  inputDiff: EntityDiff<InputSpec>;
  outputDiff: EntityDiff<OutputSpec>;
}

const EMPTY_DIFF: EntityDiff<never> = {
  lostEntities: [],
  newEntities: [],
  changedEntities: [],
};

export function computeDiffComponentSpecs(
  oldSpec: ComponentSpecJson | undefined,
  newSpec: ComponentSpecJson | undefined,
): ComponentSpecDiff {
  const inputDiff = computeDiff(
    oldSpec?.inputs,
    newSpec?.inputs,
    (a, b) => a.type === b.type,
  );
  const outputDiff = computeDiff(
    oldSpec?.outputs,
    newSpec?.outputs,
    (a, b) => a.type === b.type,
  );
  return { inputDiff, outputDiff };
}

function computeDiff<TEntity extends { name: string }>(
  prevEntities: TEntity[] | undefined,
  currentEntities: TEntity[] | undefined,
  isEqual: (oldEntity: TEntity, newEntity: TEntity) => boolean,
): EntityDiff<TEntity> {
  if (!prevEntities || !currentEntities) return EMPTY_DIFF;

  const newEntitiesIndex = new Map(currentEntities.map((i) => [i.name, i]));
  const oldEntitiesIndex = new Map(prevEntities.map((i) => [i.name, i]));

  const oldEntityNames = new Set(oldEntitiesIndex.keys());
  const newEntityNames = new Set(newEntitiesIndex.keys());

  const lostEntities = [...oldEntityNames.difference(newEntityNames)]
    .map((name) => oldEntitiesIndex.get(name))
    .filter((e) => e !== undefined);

  const newEntities = [...newEntityNames.difference(oldEntityNames)]
    .map((name) => newEntitiesIndex.get(name))
    .filter((e) => e !== undefined);

  const changedEntities = [...oldEntityNames.intersection(newEntityNames)]
    .map((name) => {
      const oldEntity = oldEntitiesIndex.get(name);
      const newEntity = newEntitiesIndex.get(name);
      if (!oldEntity || !newEntity) return undefined;
      if (isEqual(oldEntity, newEntity)) return undefined;
      return newEntity;
    })
    .filter((e) => e !== undefined);

  return { lostEntities, newEntities, changedEntities };
}

/**
 * Synthesize validation issues that an upgrade would produce, without
 * cloning the MobX-keystone model tree. After upgrade, the live
 * `ComponentSpec.validationIssues` computed gives the real issues with
 * actionable quick-fixes.
 */
export function predictUpgradeIssues(
  taskId: string,
  diff: ComponentSpecDiff,
  lostBindings: LostBinding[],
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const input of diff.inputDiff.newEntities) {
    if (!isInputRequired(input)) continue;
    issues.push({
      type: "task",
      message: `Missing required input "${input.name}"`,
      entityId: taskId,
      severity: "error",
      issueCode: "MISSING_REQUIRED_INPUT",
      argumentName: input.name,
    });
  }

  for (const binding of lostBindings) {
    const code =
      binding.reason === "lost_input"
        ? ("ORPHANED_BINDING_TARGET" as const)
        : ("ORPHANED_BINDING_SOURCE" as const);
    const port =
      binding.reason === "lost_input"
        ? binding.targetPortName
        : binding.sourcePortName;

    issues.push({
      type: "graph",
      message: `Binding will be removed (port "${port}" no longer exists)`,
      entityId: binding.bindingId,
      severity: "warning",
      issueCode: code,
    });
  }

  return issues;
}
