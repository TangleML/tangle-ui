import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { type AgentTraceEvent, recordTraceEvent } from "./agentTrace";
import {
  clearAgentTraceLog,
  readAgentTraceLog,
  startAgentTraceLog,
} from "./agentTraceLog";

function event(overrides: Partial<AgentTraceEvent> = {}): AgentTraceEvent {
  return {
    at: Date.now(),
    agent: "tangle-remote-editor",
    kind: "tool-start",
    label: "add_task",
    ...overrides,
  };
}

function settled(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe("agentTraceLog", () => {
  let stop: () => void;

  beforeEach(() => {
    clearAgentTraceLog();
    stop = startAgentTraceLog();
  });

  afterEach(() => {
    stop();
    clearAgentTraceLog();
  });

  it("collects what an agent broadcasts", async () => {
    recordTraceEvent(event({ label: "add_task" }));
    recordTraceEvent(event({ label: "connect_nodes" }));
    await settled();

    expect(readAgentTraceLog().map((one) => one.label)).toEqual([
      "add_task",
      "connect_nodes",
    ]);
  });

  /** One worker per pipeline tab plus one per project all broadcast at once. */
  it("collects from every source into one log", async () => {
    recordTraceEvent(event({ agent: "prime", label: "spawn_agent" }));
    recordTraceEvent(event({ agent: "tangle-remote-editor" }));
    await settled();

    expect(readAgentTraceLog().map((one) => one.agent)).toEqual([
      "prime",
      "tangle-remote-editor",
    ]);
  });

  it("survives a log that is not readable as events", async () => {
    localStorage.setItem("agent_trace_log", "{not json");
    recordTraceEvent(event());
    await settled();

    expect(readAgentTraceLog()).toHaveLength(1);
  });

  it("stops collecting once stopped", async () => {
    stop();
    recordTraceEvent(event());
    await settled();

    expect(readAgentTraceLog()).toEqual([]);
  });
});
