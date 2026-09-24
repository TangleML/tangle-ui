import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { type AgentTraceEvent, subscribeToTraceEvents } from "./agentTrace";
import { recordTurnReasoning } from "./recordTurnReasoning";

function settled(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe("recordTurnReasoning", () => {
  let recorded: AgentTraceEvent[];
  let unsubscribe: () => void;

  beforeEach(() => {
    recorded = [];
    unsubscribe = subscribeToTraceEvents((event) => recorded.push(event));
  });

  afterEach(() => unsubscribe());

  it("records reasoning and what the agent said", async () => {
    recordTurnReasoning("tangle-remote-editor", [
      {
        type: "reasoning_item",
        rawItem: {
          rawContent: [
            { type: "reasoning_text", text: "The task looks wrong" },
          ],
        },
      },
      {
        type: "message_output_item",
        rawItem: {
          content: [{ type: "output_text", text: "Added the task." }],
        },
      },
    ]);
    await settled();

    expect(recorded).toMatchObject([
      { kind: "thought", detail: "The task looks wrong" },
      { kind: "message", detail: "Added the task." },
    ]);
  });

  /** Only some providers return reasoning, and only for some models. */
  it("records nothing when a turn carries no reasoning", async () => {
    recordTurnReasoning("tangle-remote-editor", [
      { type: "tool_call_item", rawItem: {} },
      { type: "reasoning_item", rawItem: { rawContent: [] } },
    ]);
    await settled();

    expect(recorded).toEqual([]);
  });

  it("falls back to content when a provider sends no raw reasoning", async () => {
    recordTurnReasoning("tangle-remote-editor", [
      {
        type: "reasoning_item",
        rawItem: { content: [{ type: "input_text", text: "A summary" }] },
      },
    ]);
    await settled();

    expect(recorded[0]?.detail).toBe("A summary");
  });

  it("survives an item shape it does not recognise", async () => {
    expect(() =>
      recordTurnReasoning("tangle-remote-editor", [null, undefined, 7, {}]),
    ).not.toThrow();
  });
});
