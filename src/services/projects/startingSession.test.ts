import { afterEach, describe, expect, it, vi } from "vitest";

import {
  readStartingSession,
  startingSessionMetadata,
  withoutStartingSession,
} from "./startingSession";

const HOUR = 60 * 60 * 1000;

describe("startingSession", () => {
  afterEach(() => vi.useRealTimers());

  it("round-trips what a session should start on", () => {
    const written = startingSessionMetadata({
      prompt: "Build a churn model",
      model: "openai/gpt-5.5",
      thinkingDepth: "high",
    });

    expect(readStartingSession(written)).toEqual({
      prompt: "Build a churn model",
      model: "openai/gpt-5.5",
      thinkingDepth: "high",
    });
  });

  it("writes only what was chosen, and when", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-16T09:00:00Z"));

    expect(startingSessionMetadata({ prompt: "Go" })).toEqual({
      startingPrompt: "Go",
      startingRequestedAt: "2026-10-16T09:00:00.000Z",
    });
  });

  /**
   * The ask lives on the project, so one nobody arrived for would otherwise
   * open whichever session is started there next, days later or by someone else.
   */
  it("forgets an ask nobody arrived for within the hour", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-16T09:00:00Z"));
    const written = startingSessionMetadata({ prompt: "Go" });

    vi.setSystemTime(Date.now() + HOUR - 1000);
    expect(readStartingSession(written)?.prompt).toBe("Go");

    vi.setSystemTime(Date.now() + 2000);
    expect(readStartingSession(written)).toBeUndefined();
  });

  it("takes an ask with no time on it as stale", () => {
    expect(readStartingSession({ startingPrompt: "Go" })).toBeUndefined();
    expect(
      readStartingSession({
        startingPrompt: "Go",
        startingRequestedAt: "yesterday-ish",
      }),
    ).toBeUndefined();
  });

  /** A project someone else wrote to may carry anything under these keys. */
  it("takes a prompt that is not a prompt as no prompt at all", () => {
    expect(readStartingSession({ startingPrompt: 42 })).toBeUndefined();
    expect(readStartingSession({ startingPrompt: "  " })).toBeUndefined();
    expect(readStartingSession(null)).toBeUndefined();
  });

  it("drops a thinking depth the agent could not run", () => {
    const session = readStartingSession({
      ...startingSessionMetadata({ prompt: "Go" }),
      startingThinkingDepth: "ludicrous",
    });

    expect(session?.thinkingDepth).toBeUndefined();
    expect(session?.prompt).toBe("Go");
  });

  /** Left behind, the prompt would run again on the next visit. */
  it("clears every key it wrote and nothing else", () => {
    const written = {
      ...startingSessionMetadata({
        prompt: "Go",
        model: "openai/gpt-5.5",
        thinkingDepth: "low",
      }),
      keepMe: true,
    };

    expect(withoutStartingSession(written)).toEqual({ keepMe: true });
  });

  it("leaves a project that was never given one alone", () => {
    expect(withoutStartingSession({ keepMe: true })).toEqual({ keepMe: true });
    expect(withoutStartingSession(null)).toEqual({});
  });
});
