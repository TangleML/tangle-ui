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

export type DiffStatus = "unchanged" | "lost" | "new" | "changed";

export interface DiffEntry<T> {
  entry: T;
  status: DiffStatus;
}

/**
 * Merges a list of current entries with an `EntityDiff` delta to produce a flat
 * list annotated with diff status. Preserves the order of `currentEntries` and
 * appends new entries at the end.
 */
export function buildFlatDiffList<
  T extends { name: string },
  TNew extends { name: string },
>(
  currentEntries: T[],
  diff: EntityDiff<TNew>,
  mapNewEntry: (e: TNew) => T,
): DiffEntry<T>[] {
  const lostNames = new Set(diff.lostEntities.map((e) => e.name));
  const changedNames = new Set(diff.changedEntities.map((e) => e.name));

  const result: DiffEntry<T>[] = currentEntries.map((entry) => {
    if (lostNames.has(entry.name)) return { entry, status: "lost" as const };
    if (changedNames.has(entry.name))
      return { entry, status: "changed" as const };
    return { entry, status: "unchanged" as const };
  });

  for (const newEntry of diff.newEntities) {
    result.push({ entry: mapNewEntry(newEntry), status: "new" });
  }

  return result;
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
    const portDisplay =
      binding.reason === "lost_input"
        ? `input "${binding.targetPortName}"`
        : `output "${binding.sourcePortName}"`;

    issues.push({
      type: "graph",
      message: `Connection will be lost (${portDisplay} no longer exists)`,
      entityId: binding.bindingId,
      severity: "warning",
      issueCode: code,
    });
  }

  return issues;
}
