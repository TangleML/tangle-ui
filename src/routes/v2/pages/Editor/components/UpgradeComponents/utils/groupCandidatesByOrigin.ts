import type { UpgradeCandidate } from "@/routes/v2/pages/Editor/components/UpgradeComponents/types";

export interface CandidateGroup {
  /** Null for candidates that have no lineage origin (pre-lineage tasks). */
  originId: string | null;
  /** Component name from the upgrade target, for the group header. */
  componentName: string;
  candidates: UpgradeCandidate[];
}

/**
 * Group upgrade candidates by their lineage origin. Returns groups only when
 * there is meaningful grouping — at least one origin with multiple candidates,
 * or any off-mainline candidate. Otherwise returns null (flat render unchanged).
 *
 * Groups are ordered: multi-candidate families first, then singletons, then
 * ungrouped (no origin). Within each group candidates are in their original order.
 */
export function groupCandidatesByOrigin(
  candidates: UpgradeCandidate[],
): CandidateGroup[] | null {
  const hasOffMainline = candidates.some((c) => c.isEditedOffMainline);
  const byOrigin = new Map<string, UpgradeCandidate[]>();
  const noOrigin: UpgradeCandidate[] = [];

  for (const c of candidates) {
    if (c.originId) {
      const group = byOrigin.get(c.originId) ?? [];
      group.push(c);
      byOrigin.set(c.originId, group);
    } else {
      noOrigin.push(c);
    }
  }

  const hasMultiGroup = [...byOrigin.values()].some((g) => g.length > 1);
  if (!hasMultiGroup && !hasOffMainline) return null;

  const groups: CandidateGroup[] = [];

  for (const [originId, groupCandidates] of byOrigin) {
    groups.push({
      originId,
      componentName:
        groupCandidates[0].newComponentRef.name ?? groupCandidates[0].taskName,
      candidates: groupCandidates,
    });
  }

  // Sort: multi-candidate families first, then singletons.
  groups.sort((a, b) => b.candidates.length - a.candidates.length);

  if (noOrigin.length > 0) {
    groups.push({
      originId: null,
      componentName: "",
      candidates: noOrigin,
    });
  }

  return groups;
}
