import type {
  ComponentSpecJson,
  InputSpec,
  ValidationIssue,
} from "@/models/componentSpec";
import type { OutputSpec } from "@/models/componentSpec/entities/types";
import { isInputRequired } from "@/models/componentSpec/validation/validateSpec";
import type { LostBinding } from "@/routes/v2/pages/Editor/components/UpgradeComponents/types";
import { diffComponentIO, type EntityDiff } from "@/utils/componentSpecDiff";

export type { EntityDiff };

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

export function computeDiffComponentSpecs(
  oldSpec: ComponentSpecJson | undefined,
  newSpec: ComponentSpecJson | undefined,
): ComponentSpecDiff {
  return diffComponentIO<InputSpec, OutputSpec>(oldSpec, newSpec);
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
