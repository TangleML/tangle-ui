import { useOutdatedComponents } from "@/components/shared/ManageComponent/hooks/useOutdatedComponents";
import type { ComponentReference } from "@/models/componentSpec";
import type { UpgradeCandidate } from "@/routes/v2/pages/Editor/components/UpgradeComponents/types";
import { buildUpgradeCandidateFromResolved } from "@/routes/v2/pages/Editor/components/UpgradeComponents/utils/buildUpgradeCandidateFromResolved";
import {
  collectUsedComponentReferencesFromV2Spec,
  EMPTY_USED_COMPONENTS,
} from "@/routes/v2/pages/Editor/components/UpgradeComponents/utils/collectUsedComponentReferencesFromV2Spec";
import { useSpec } from "@/routes/v2/shared/providers/SpecContext";

/**
 * Upgrade candidates derived from {@link useOutdatedComponents} for the
 * current graph's used components, aligned with {@link replaceTask} previews.
 *
 * The window is only opened from the V2 editor, so {@link useSpec} should
 * always return a non-null spec here; the null branch is defensive and
 * returns no candidates without iterating the spec.
 */
export function useUpgradeCandidatesFromOutdated(): UpgradeCandidate[] {
  const spec = useSpec();

  const usedComponents = spec
    ? collectUsedComponentReferencesFromV2Spec(spec)
    : EMPTY_USED_COMPONENTS;

  const { data: outdatedPairs } = useOutdatedComponents(usedComponents);

  if (!spec) {
    return [];
  }

  const digestToMrc = new Map<string, ComponentReference>();
  for (const [outdated, mrc] of outdatedPairs) {
    digestToMrc.set(outdated.digest, mrc);
  }

  const candidates: UpgradeCandidate[] = [];
  for (const task of spec.tasks) {
    const digest = task.componentRef.digest;
    if (!digest) {
      continue;
    }
    const newComponentRef = digestToMrc.get(digest);
    if (!newComponentRef) {
      continue;
    }

    candidates.push(
      buildUpgradeCandidateFromResolved(
        task.$id,
        task.name,
        digest,
        task.resolvedComponentSpec,
        newComponentRef,
        spec,
      ),
    );
  }

  return candidates;
}
