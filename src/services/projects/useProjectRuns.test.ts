import { describe, expect, it } from "vitest";

import { runPollInterval } from "./useProjectRuns";

describe("runPollInterval", () => {
  /** The reported bug: a finished run sat at "Waiting for upstream" until reload. */
  it("keeps polling a run that is still going", () => {
    expect(runPollInterval({ RUNNING: 2, SUCCEEDED: 1 })).toBeGreaterThan(0);
  });

  it("stops once every execution has settled", () => {
    expect(runPollInterval({ SUCCEEDED: 4 })).toBe(false);
  });

  it("stops on a run that settled without succeeding", () => {
    expect(runPollInterval({ SUCCEEDED: 1, FAILED: 1 })).toBe(false);
  });

  /**
   * No executions is a run that has not started, not one that has finished —
   * the state a queued run reports before the backend expands it.
   */
  it("keeps polling a run with nothing to report yet", () => {
    expect(runPollInterval({})).toBeGreaterThan(0);
    expect(runPollInterval(null)).toBeGreaterThan(0);
    expect(runPollInterval(undefined)).toBeGreaterThan(0);
  });
});
