import { describe, expect, it } from "vitest";

import { needsReview, runAsFor, runIdentity, teamIdFor } from "./runIdentity";

const TEAM = { id: "search@example.com", label: "Search" };

const named = (...names: string[]) => names.map((name) => ({ name }));

function identityFor(
  referenced: string[],
  yours: string[],
  teams: string[] | undefined,
) {
  return runIdentity({
    team: teams ? TEAM : undefined,
    referenced,
    yourSecrets: named(...yours),
    teamSecrets: teams && named(...teams),
  });
}

describe("runIdentity", () => {
  it("runs as you when the run uses no secrets", () => {
    const identity = identityFor([], [], []);

    expect(identity.rule).toEqual({ kind: "open", defaultAs: "you" });
    expect(runAsFor(identity)).toBe("you");
    expect(needsReview(identity)).toBe(false);
  });

  it("runs as you when you have every secret, and lets you choose the team", () => {
    const identity = identityFor(["TEST_PERSONAL"], ["TEST_PERSONAL"], []);

    expect(identity.rule).toEqual({ kind: "open", defaultAs: "you" });
    expect(runAsFor(identity, "team")).toBe("team");
    expect(identity.missing).toEqual({ you: [], team: ["TEST_PERSONAL"] });
  });

  it("forces the team when only the team has secrets you lack", () => {
    const identity = identityFor(
      ["TEST_PERSONAL", "Test"],
      ["TEST_PERSONAL"],
      ["TEST_PERSONAL", "Test"],
    );

    expect(identity.rule).toEqual({
      kind: "team-required",
      teamOnly: ["Test"],
    });
    expect(runAsFor(identity)).toBe("team");
    expect(runAsFor(identity, "you")).toBe("team");
    expect(teamIdFor(identity, runAsFor(identity))).toBe(TEAM.id);
    expect(needsReview(identity)).toBe(false);
  });

  it("says which side has which when no identity has every secret", () => {
    const identity = identityFor(
      ["TEST_PERSONAL", "Test"],
      ["TEST_PERSONAL"],
      ["Test"],
    );

    expect(identity.rule).toEqual({
      kind: "split",
      yoursOnly: ["TEST_PERSONAL"],
      teamOnly: ["Test"],
    });
    expect(runAsFor(identity)).toBe("you");
    expect(needsReview(identity)).toBe(true);
  });

  it("runs as you when a secret is missing from both", () => {
    const identity = identityFor(["GONE"], [], []);

    expect(identity.rule).toEqual({ kind: "open", defaultAs: "you" });
    expect(identity.missing).toEqual({ you: ["GONE"], team: ["GONE"] });
    expect(needsReview(identity)).toBe(true);
  });

  it("defaults to the team when it has more of the secrets but not all", () => {
    const identity = identityFor(["Test", "GONE"], [], ["Test"]);

    expect(identity.rule).toEqual({ kind: "open", defaultAs: "team" });
    expect(runAsFor(identity)).toBe("team");
    expect(identity.missing.team).toEqual(["GONE"]);
  });

  it("only runs as you without a team to act as", () => {
    const identity = identityFor(["Test"], [], undefined);

    expect(identity.rule).toEqual({ kind: "open", defaultAs: "you" });
    expect(runAsFor(identity, "team")).toBe("you");
    expect(teamIdFor(identity, "team")).toBeUndefined();
    expect(identity.missing).toEqual({ you: ["Test"], team: [] });
  });

  it("treats a list it couldn't read as having every secret", () => {
    const identity = runIdentity({
      team: TEAM,
      referenced: ["Test"],
      teamSecrets: named("Test"),
    });

    expect(identity.rule).toEqual({ kind: "open", defaultAs: "you" });
    expect(identity.missing).toEqual({ you: [], team: [] });
  });
});
