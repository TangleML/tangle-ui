import { describe, expect, it } from "vitest";

import type { UpgradeCandidate } from "@/routes/v2/pages/Editor/components/UpgradeComponents/types";

import { groupCandidatesByOrigin } from "./groupCandidatesByOrigin";

function candidate(
  taskId: string,
  opts: { originId?: string; isEditedOffMainline?: boolean } = {},
): UpgradeCandidate {
  return {
    taskId,
    taskName: taskId,
    currentDigest: "old",
    newComponentRef: { name: "Component", digest: "new" },
    inputDiff: { lostEntities: [], newEntities: [], changedEntities: [] },
    outputDiff: { lostEntities: [], newEntities: [], changedEntities: [] },
    lostBindings: [],
    predictedIssues: [],
    ...opts,
  };
}

describe("groupCandidatesByOrigin", () => {
  it("returns null when all candidates have different origins (no meaningful grouping)", () => {
    const candidates = [
      candidate("a", { originId: "https://x/a.yaml" }),
      candidate("b", { originId: "https://x/b.yaml" }),
    ];
    expect(groupCandidatesByOrigin(candidates)).toBeNull();
  });

  it("returns null when no candidates have an originId", () => {
    expect(
      groupCandidatesByOrigin([candidate("a"), candidate("b")]),
    ).toBeNull();
  });

  it("groups candidates sharing the same originId", () => {
    const candidates = [
      candidate("a", { originId: "https://x/c.yaml" }),
      candidate("b", { originId: "https://x/c.yaml" }),
      candidate("c", { originId: "https://x/other.yaml" }),
    ];

    const groups = groupCandidatesByOrigin(candidates);
    expect(groups).not.toBeNull();
    expect(groups).toHaveLength(2);
    expect(groups![0].candidates.map((c) => c.taskId)).toEqual(["a", "b"]);
    expect(groups![0].componentName).toBe("Component");
  });

  it("triggers grouping when any candidate is edited-off-mainline", () => {
    const candidates = [
      candidate("a", { originId: "https://x/c.yaml" }),
      candidate("b", {
        originId: "https://x/c.yaml",
        isEditedOffMainline: true,
      }),
    ];

    const groups = groupCandidatesByOrigin(candidates);
    expect(groups).not.toBeNull();
  });

  it("places candidates without originId in an ungrouped section at the end", () => {
    const candidates = [
      candidate("a", { originId: "https://x/c.yaml" }),
      candidate("b", { originId: "https://x/c.yaml" }),
      candidate("c"),
    ];

    const groups = groupCandidatesByOrigin(candidates)!;
    const last = groups[groups.length - 1];
    expect(last.originId).toBeNull();
    expect(last.candidates.map((c) => c.taskId)).toEqual(["c"]);
  });
});
