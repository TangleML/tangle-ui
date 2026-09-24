import { EventEmitter } from "node:events";

import { beforeEach, describe, expect, it } from "vitest";

import type { StatusCallback } from "../types";
import { clearTraceEvents, readTraceEvents } from "./agentTrace";
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

describe("attachObservabilityHooks", () => {
  let emitStatus: StatusCallback;
  let statuses: string[];

  beforeEach(() => {
    clearTraceEvents();
    statuses = [];
    emitStatus = (status: { text: string }) => {
      statuses.push(status.text);
    };
  });

  it("still drives the status line", () => {
    const { agent, emit } = fakeAgent();
    attachObservabilityHooks(agent, emitStatus);

    emit("agent_start");
    emit("agent_tool_start", {}, { name: "add_task" }, toolCall("c1"));

    expect(statuses).toEqual(["Thinking...", "Adding task..."]);
  });

  /** The status line is overwritten by the next event; the trace is the record. */
  it("records a tool call's arguments and its result", () => {
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

    const [start, end] = readTraceEvents();
    expect(start).toMatchObject({
      agent: "tangle-remote-editor",
      kind: "tool-start",
      label: "add_task",
      detail: '{"name":"Fetch articles"}',
    });
    expect(end).toMatchObject({
      kind: "tool-end",
      label: "add_task",
      detail: '{"success":true,"taskId":"task-1"}',
    });
    expect(end.durationMs).toBeGreaterThanOrEqual(0);
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

    const detail = readTraceEvents()[0]?.detail ?? "";
    expect(detail).toContain("(5000 chars)");
    expect(detail.length).toBeLessThan(2100);
  });

  /** A hung bridge call and a finished turn otherwise look identical. */
  it("records a tool that never returned when the turn ends", () => {
    const { agent, emit } = fakeAgent();
    attachObservabilityHooks(agent, emitStatus);

    emit("agent_tool_start", {}, { name: "add_task" }, toolCall("c1"));
    emit("agent_end");

    expect(
      readTraceEvents().some(
        (event) => event.kind === "tool-hung" && event.label === "add_task",
      ),
    ).toBe(true);
  });

  it("does not record a hang for a tool that did return", () => {
    const { agent, emit } = fakeAgent();
    attachObservabilityHooks(agent, emitStatus);

    emit("agent_tool_start", {}, { name: "add_task" }, toolCall("c1"));
    emit("agent_tool_end", {}, { name: "add_task" }, "ok", toolCall("c1"));
    emit("agent_end");

    expect(readTraceEvents().some((event) => event.kind === "tool-hung")).toBe(
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
    expect(readTraceEvents()).toEqual([]);
  });
});
