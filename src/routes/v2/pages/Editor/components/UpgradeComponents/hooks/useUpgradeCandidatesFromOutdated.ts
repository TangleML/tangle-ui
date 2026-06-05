import { useOutdatedComponents } from "@/components/shared/ManageComponent/hooks/useOutdatedComponents";
import type { ComponentReference, ComponentSpec } from "@/models/componentSpec";
import type { UpgradeCandidate } from "@/routes/v2/pages/Editor/components/UpgradeComponents/types";
import { buildUpgradeCandidateFromResolved } from "@/routes/v2/pages/Editor/components/UpgradeComponents/utils/buildUpgradeCandidateFromResolved";
import {
  collectUsedComponentReferencesFromV2Spec,
  EMPTY_USED_COMPONENTS,
} from "@/routes/v2/pages/Editor/components/UpgradeComponents/utils/collectUsedComponentReferencesFromV2Spec";
import { useSpec } from "@/routes/v2/shared/providers/SpecContext";
import { LINEAGE_ORIGIN_ANNOTATION } from "@/utils/lineage";

/**
 * Upgrade candidates derived from {@link useOutdatedComponents} for the
 * current graph's used components, aligned with {@link replaceTask} previews.
 * Recurses through subgraphs so nested tasks are included. Also surfaces
 * "edited-off-mainline" tasks: instances whose digests were changed locally
 * so they fell out of the catalog's supersession chain, but whose lineage
 * still traces back to a component family that has an upgrade available.
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
  const seenTaskIds = new Set<string>();
  // originId → newRef for the off-mainline secondary pass.
  const originIdToNewRef = new Map<string, ComponentReference>();

  // Primary walk: tasks whose digest is directly in the supersession chain.
  // `s` is each task's immediately-owning spec so lost-binding checks are scoped
  // to the bindings at that nesting level (not the root).
  function walkPrimary(s: ComponentSpec) {
    for (const task of s.tasks) {
      const digest = task.componentRef.digest;
      const newComponentRef = digest ? digestToMrc.get(digest) : undefined;
      const originId = task.annotations.get(
        LINEAGE_ORIGIN_ANNOTATION,
      )?.originId;

      if (newComponentRef && digest) {
        candidates.push({
          ...buildUpgradeCandidateFromResolved(
            task.$id,
            task.name,
            digest,
            task.resolvedComponentSpec,
            newComponentRef,
            s,
          ),
          originId,
        });
        seenTaskIds.add(task.$id);
        if (originId) originIdToNewRef.set(originId, newComponentRef);
      }

      if (task.subgraphSpec) walkPrimary(task.subgraphSpec);
    }
  }

  walkPrimary(spec);

  // Secondary walk: tasks that were locally edited (digest off-chain) but share
  // a lineage origin with a family that does have an upgrade available.
  function walkOffMainline(s: ComponentSpec) {
    for (const task of s.tasks) {
      if (!seenTaskIds.has(task.$id)) {
        const originId = task.annotations.get(
          LINEAGE_ORIGIN_ANNOTATION,
        )?.originId;
        const newComponentRef = originId
          ? originIdToNewRef.get(originId)
          : undefined;

        if (originId && newComponentRef) {
          const digest = task.componentRef.digest ?? "";
          candidates.push({
            ...buildUpgradeCandidateFromResolved(
              task.$id,
              task.name,
              digest,
              task.resolvedComponentSpec,
              newComponentRef,
              s,
            ),
            originId,
            isEditedOffMainline: true,
          });
          seenTaskIds.add(task.$id);
        }
      }

      if (task.subgraphSpec) walkOffMainline(task.subgraphSpec);
    }
  }

  walkOffMainline(spec);

  return candidates;
}
