import { describe, expect, it } from "vitest";

import { runStatesFromSnapshot, withRunStatus } from "./useSessionRunStates";

describe("session run states", () => {
  it("keeps only the sessions with an agent working or a failed last run", () => {
    const states = runStatesFromSnapshot({
      statuses: [
        { sessionId: "s-busy", status: "busy" },
        { sessionId: "s-quiet", status: "active" },
        { sessionId: "s-failed", status: "active", failed: true },
        { sessionId: "s-gone", status: "idle", failed: true },
        { status: "busy" },
      ],
    });

    expect([...states]).toEqual([
      ["s-busy", "working"],
      ["s-failed", "failed"],
      ["s-gone", "failed"],
    ]);
  });

  it("marks a session as it starts working and clears it once it's quiet", () => {
    const working = withRunStatus(new Map(), {
      sessionId: "s-1",
      status: "busy",
    });
    expect(working.get("s-1")).toBe("working");

    const failed = withRunStatus(working, {
      sessionId: "s-1",
      status: "active",
      failed: true,
    });
    expect(failed.get("s-1")).toBe("failed");

    const quiet = withRunStatus(failed, { sessionId: "s-1", status: "active" });
    expect(quiet.has("s-1")).toBe(false);
    expect(withRunStatus(quiet, "not a status")).toBe(quiet);
  });
});
