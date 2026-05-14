import type {
  ComponentReference,
  ComponentSpec,
  ComponentSpecJson,
} from "@/models/componentSpec";
import type {
  LostBinding,
  UpgradeCandidate,
} from "@/routes/v2/pages/Editor/components/UpgradeComponents/types";
import {
  computeDiffComponentSpecs,
  predictUpgradeIssues,
} from "@/routes/v2/pages/Editor/store/actions/task.utils";

function collectLostBindings(
  taskId: string,
  diff: ReturnType<typeof computeDiffComponentSpecs>,
  spec: ComponentSpec,
): LostBinding[] {
  const lostInputNames = new Set(
    diff.inputDiff.lostEntities.map((i) => i.name),
  );
  const lostOutputNames = new Set(
    diff.outputDiff.lostEntities.map((o) => o.name),
  );

  const result: LostBinding[] = [];

  for (const b of spec.bindings) {
    if (b.targetEntityId === taskId && lostInputNames.has(b.targetPortName)) {
      result.push({
        bindingId: b.$id,
        sourceEntityId: b.sourceEntityId,
        sourcePortName: b.sourcePortName,
        targetEntityId: b.targetEntityId,
        targetPortName: b.targetPortName,
        reason: "lost_input",
      });
    }
    if (b.sourceEntityId === taskId && lostOutputNames.has(b.sourcePortName)) {
      result.push({
        bindingId: b.$id,
        sourceEntityId: b.sourceEntityId,
        sourcePortName: b.sourcePortName,
        targetEntityId: b.targetEntityId,
        targetPortName: b.targetPortName,
        reason: "lost_output",
      });
    }
  }

  return result;
}

/**
 * Builds an upgrade candidate using the same old/new spec pairing as
 * {@link replaceTask} (resolved task spec vs target component ref spec).
 */
export function buildUpgradeCandidateFromResolved(
  taskId: string,
  taskName: string,
  currentDigest: string,
  resolvedComponentSpec: ComponentSpecJson | undefined,
  newComponentRef: ComponentReference,
  spec: ComponentSpec,
): UpgradeCandidate {
  const diff = computeDiffComponentSpecs(
    resolvedComponentSpec,
    newComponentRef.spec,
  );
  const lostBindings = collectLostBindings(taskId, diff, spec);
  const predictedIssues = predictUpgradeIssues(taskId, diff, lostBindings);

  return {
    taskId,
    taskName,
    currentDigest,
    newComponentRef,
    inputDiff: diff.inputDiff,
    outputDiff: diff.outputDiff,
    lostBindings,
    predictedIssues,
  };
}
