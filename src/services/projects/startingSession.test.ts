import { describe, expect, it } from "vitest";

import {
  readStartingSession,
  startingSessionExtraData,
  withoutStartingSession,
} from "./startingSession";

describe("startingSession", () => {
  it("round-trips what a session should start on", () => {
    const written = startingSessionExtraData({
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

  it("writes only what was chosen", () => {
    expect(startingSessionExtraData({ prompt: "Go" })).toEqual({
      startingPrompt: "Go",
    });
  });

  /** A project someone else wrote to may carry anything under these keys. */
  it("takes a prompt that is not a prompt as no prompt at all", () => {
    expect(readStartingSession({ startingPrompt: 42 })).toBeUndefined();
    expect(readStartingSession({ startingPrompt: "  " })).toBeUndefined();
    expect(readStartingSession(null)).toBeUndefined();
  });

  it("drops a thinking depth the agent could not run", () => {
    const session = readStartingSession({
      startingPrompt: "Go",
      startingThinkingDepth: "ludicrous",
    });

    expect(session?.thinkingDepth).toBeUndefined();
    expect(session?.prompt).toBe("Go");
  });

  /** Left behind, the prompt would run again on the next visit. */
  it("clears every key it wrote and nothing else", () => {
    const written = {
      ...startingSessionExtraData({
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
