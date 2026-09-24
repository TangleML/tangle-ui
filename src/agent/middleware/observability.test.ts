import { EventEmitter } from "node:events";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { StatusCallback } from "../types";
import { attachObservabilityHooks } from "./observability";

type Agent = Parameters<typeof attachObservabilityHooks>[0];

/**
 * The hooks only ever read `name` and the `EventEmitter` an `Agent` inherits,
 * so a real one would be a model client and a tool registry for nothing. `emit`
 * is handed back untyped because the emitter's own signature demands a
 * `RunContext` the hooks never look at.
 */
function fakeAgent(name = "tangle-remote-editor") {
  const emitter = new EventEmitter();
  return {
    agent: Object.assign(emitter, { name }) as unknown as Agent,
    emit: (event: string, ...args: unknown[]) => emitter.emit(event, ...args),
  };
}

function toolCall(callId: string, args?: string) {
  return { toolCall: { type: "function_call", callId, arguments: args } };
}

function silenceConsoleInfo() {
  return vi.spyOn(console, "info").mockImplementation(() => {});
}

describe("attachObservabilityHooks", () => {
  let info: ReturnType<typeof silenceConsoleInfo>;
  let emitStatus: StatusCallback;
  let statuses: string[];

  function tracedLines(): string[] {
    return info.mock.calls.map((call) => String(call[0]));
  }

  beforeEach(() => {
    info = silenceConsoleInfo();
    statuses = [];
    emitStatus = (status: { text: string }) => {
      statuses.push(status.text);
    };
  });

  afterEach(() => {
    info.mockRestore();
  });

  it("still drives the status line", () => {
    const { agent, emit } = fakeAgent();
    attachObservabilityHooks(agent, emitStatus);

    emit("agent_start");
    emit("agent_tool_start", {}, { name: "add_task" }, toolCall("c1"));

    expect(statuses).toEqual(["Thinking...", "Adding task..."]);
  });

  /** The status line is overwritten by the next event; the trace is the record. */
  it("traces a tool call's arguments and its result", () => {
    const { agent, emit } = fakeAgent();
    attachObservabilityHooks(agent, emitStatus);

    emit(
      "agent_tool_start",
      {},
      { name: "add_task" },
      toolCall("c1", '{"name":"Fetch articles"}'),
    );
    emit(
      "agent_tool_end",
      {},
      { name: "add_task" },
      '{"success":true,"taskId":"task-1"}',
      toolCall("c1"),
    );

    const [start, end] = info.mock.calls;
    expect(String(start[0])).toContain("tool start add_task");
    expect(start[1]).toBe('{"name":"Fetch articles"}');
    expect(String(end[0])).toMatch(/tool end add_task \d+ms/);
    expect(end[1]).toBe('{"success":true,"taskId":"task-1"}');
  });

  it("truncates a payload too large to read", () => {
    const { agent, emit } = fakeAgent();
    attachObservabilityHooks(agent, emitStatus);

    emit(
      "agent_tool_end",
      {},
      { name: "get_pipeline_state" },
      "x".repeat(5000),
      toolCall("c1"),
    );

    const logged = String(info.mock.calls[0][1]);
    expect(logged).toContain("(5000 chars)");
    expect(logged.length).toBeLessThan(2100);
  });

  /** A hung bridge call and a finished turn otherwise look identical. */
  it("reports a tool that never returned when the turn ends", () => {
    const { agent, emit } = fakeAgent();
    attachObservabilityHooks(agent, emitStatus);

    emit("agent_tool_start", {}, { name: "add_task" }, toolCall("c1"));
    emit("agent_end");

    expect(
      tracedLines().some((line) =>
        line.includes("tool never returned add_task"),
      ),
    ).toBe(true);
  });

  it("does not report a tool that did return", () => {
    const { agent, emit } = fakeAgent();
    attachObservabilityHooks(agent, emitStatus);

    emit("agent_tool_start", {}, { name: "add_task" }, toolCall("c1"));
    emit("agent_tool_end", {}, { name: "add_task" }, "ok", toolCall("c1"));
    emit("agent_end");

    expect(tracedLines().some((line) => line.includes("never returned"))).toBe(
      false,
    );
  });

  /** A throw inside a lifecycle hook takes the agent's turn down with it. */
  it("survives a tool call payload it does not recognise", () => {
    const { agent, emit } = fakeAgent();
    attachObservabilityHooks(agent, emitStatus);

    expect(() => {
      emit("agent_tool_start", {}, { name: "add_task" }, undefined);
      emit("agent_tool_end", {}, { name: "add_task" }, "ok", {
        toolCall: null,
      });
    }).not.toThrow();
  });

  it("detaches every listener it attached", () => {
    const { agent, emit } = fakeAgent();
    const dispose = attachObservabilityHooks(agent, emitStatus);

    dispose();
    emit("agent_start");
    emit("agent_tool_start", {}, { name: "add_task" }, toolCall("c1"));

    expect(statuses).toEqual([]);
    expect(info).not.toHaveBeenCalled();
  });
});
