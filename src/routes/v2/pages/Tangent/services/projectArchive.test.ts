import { describe, expect, it } from "vitest";

import { archivedTargets, withArchived } from "./projectArchive";

describe("project archive", () => {
  it("reads only the archived targets, ignoring anything malformed", () => {
    expect(
      archivedTargets({ tangentArchived: ["run://id/r-1", 7, null] }),
    ).toEqual(["run://id/r-1"]);
    expect(archivedTargets(null)).toEqual([]);
  });

  it("archives and restores a target, keeping the rest of the metadata", () => {
    const archived = withArchived(
      { startingSession: { prompt: "Hi" } },
      "run://id/r-1",
      true,
    );
    expect(archived).toEqual({
      startingSession: { prompt: "Hi" },
      tangentArchived: ["run://id/r-1"],
    });

    expect(withArchived(archived, "run://id/r-1", false)).toEqual({
      startingSession: { prompt: "Hi" },
      tangentArchived: [],
    });
  });

  it("archives a target once, however often it's asked", () => {
    const twice = withArchived(
      withArchived(null, "pipeline://id/p-1", true),
      "pipeline://id/p-1",
      true,
    );
    expect(archivedTargets(twice)).toEqual(["pipeline://id/p-1"]);
  });
});
