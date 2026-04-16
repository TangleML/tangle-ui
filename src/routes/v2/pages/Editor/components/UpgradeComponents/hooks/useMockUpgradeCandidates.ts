import type { ComponentReference } from "@/models/componentSpec";
import type { ComponentSpec } from "@/models/componentSpec/entities/componentSpec";
import type {
  InputSpec,
  OutputSpec,
} from "@/models/componentSpec/entities/types";
import type {
  LostBinding,
  UpgradeCandidate,
} from "@/routes/v2/pages/Editor/components/UpgradeComponents/types";
import {
  computeDiffComponentSpecs,
  predictUpgradeIssues,
} from "@/routes/v2/pages/Editor/store/actions/task.utils";
import { useSpec } from "@/routes/v2/shared/providers/SpecContext";

/**
 * Deterministic hash so the same task always produces the same mock mutations.
 */
function simpleHash(str: string): number {
  let hash = 0;
  for (const ch of str) {
    hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  }
  return Math.abs(hash);
}

/** Pick a deterministic subset of items to keep/drop based on a seed. */
function pickIndices(seed: number, length: number, dropRate: number): number[] {
  return Array.from({ length }, (_, i) => i).filter(
    (i) => simpleHash(`${seed}-${i}`) % 100 >= dropRate * 100,
  );
}

function mutateInputs(inputs: InputSpec[], seed: number): InputSpec[] {
  const kept = pickIndices(seed, inputs.length, 0.3).map((i) => {
    const input = inputs[i];
    const shouldRename = simpleHash(`rename-in-${seed}-${i}`) % 5 === 0;
    const shouldChangeType = simpleHash(`type-in-${seed}-${i}`) % 4 === 0;

    return {
      ...input,
      name: shouldRename ? `${input.name}_v${seed}` : input.name,
      type: shouldChangeType ? "String" : input.type,
    };
  });

  const addCount = seed % 3;
  const added: InputSpec[] = Array.from({ length: addCount }, (_, i) => ({
    name: `new_required_input_${i}`,
    type: "String" as const,
  }));

  return [...kept, ...added];
}

function mutateOutputs(outputs: OutputSpec[], seed: number): OutputSpec[] {
  const kept = pickIndices(seed + 7, outputs.length, 0.25).map((i) => {
    const output = outputs[i];
    const shouldRename = simpleHash(`rename-out-${seed}-${i}`) % 6 === 0;

    return {
      ...output,
      name: shouldRename ? `${output.name}_v2` : output.name,
    };
  });

  const addCount = (seed + 1) % 2;
  const added: OutputSpec[] = Array.from({ length: addCount }, (_, i) => ({
    name: `new_output_${i}`,
    type: "Artifact" as const,
  }));

  return [...kept, ...added];
}

function buildMockComponentRef(
  original: ComponentReference,
  taskName: string,
): ComponentReference {
  const seed = simpleHash(taskName);
  const originalInputs = original.spec?.inputs ?? [];
  const originalOutputs = original.spec?.outputs ?? [];

  const inputs = mutateInputs(originalInputs, seed);
  const outputs = mutateOutputs(originalOutputs, seed);

  return {
    ...original,
    digest: `mock-digest-${taskName}`,
    spec: original.spec ? { ...original.spec, inputs, outputs } : undefined,
  };
}

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

function buildCandidate(
  taskId: string,
  taskName: string,
  currentRef: ComponentReference,
  spec: ComponentSpec,
): UpgradeCandidate | null {
  const currentDigest = currentRef.digest;
  if (!currentDigest) return null;

  const newComponentRef = buildMockComponentRef(currentRef, taskName);
  const diff = computeDiffComponentSpecs(currentRef.spec, newComponentRef.spec);
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

/**
 * Phase 1 mock hook that generates fake upgrade candidates from the current spec.
 * Toggle `enabled` to control whether candidates are produced.
 */
export function useMockUpgradeCandidates(enabled = true): UpgradeCandidate[] {
  const spec = useSpec();
  if (!enabled || !spec) return [];

  const candidates: UpgradeCandidate[] = [];
  let count = 0;
  for (const task of spec.tasks) {
    const candidate = buildCandidate(
      task.$id,
      task.name,
      task.componentRef,
      spec,
    );
    if (candidate) candidates.push(candidate);
    count++;
    if (count > spec.tasks.length / 2) break;
  }

  candidates.push({
    taskId: spec.tasks[count].$id,
    taskName: spec.tasks[count].name,
    currentDigest: "clean-digest",
    newComponentRef: spec.tasks[count].componentRef,
    inputDiff: {
      lostEntities: [],
      newEntities: [],
      changedEntities: [],
    },
    outputDiff: {
      lostEntities: [],
      newEntities: [],
      changedEntities: [],
    },
    lostBindings: [],
    predictedIssues: [],
  });

  return candidates;
}
