import assert from "node:assert/strict";
import { test } from "node:test";

import type {
  RemoteKillCommand,
  RemoteMessageCommand,
} from "@tangent/remote-subagent";

import { EarlyMessageBuffer } from "./earlyMessageBuffer.ts";

function message(agentId: string, text: string): RemoteMessageCommand {
  return { sessionId: "s1", agentId, text, delivery: "auto" };
}

function kill(agentId: string): RemoteKillCommand {
  return { sessionId: "s1", agentId, completed: false };
}

interface Harness {
  buffer: EarlyMessageBuffer;
  delivered: RemoteMessageCommand[];
  killed: RemoteKillCommand[];
  onMessage: (command: RemoteMessageCommand) => void;
  onKill: (command: RemoteKillCommand) => void;
  advance: (ms: number) => void;
}

function harness(
  options: { ttlMs?: number; maxMessages?: number } = {},
): Harness {
  const delivered: RemoteMessageCommand[] = [];
  const killed: RemoteKillCommand[] = [];
  let clock = 0;
  const buffer = new EarlyMessageBuffer(() => {}, {
    ...options,
    now: () => clock,
  });
  const wrapped = buffer.wrap({
    onSpawn: () => {},
    onMessage: (command) => {
      delivered.push(command);
    },
    onKill: (command) => {
      killed.push(command);
    },
  });
  const onMessage = wrapped.onMessage;
  const onKill = wrapped.onKill;
  if (!onMessage || !onKill) {
    throw new Error("wrap must return onMessage and onKill handlers");
  }
  return {
    buffer,
    delivered,
    killed,
    onMessage: (command) => void onMessage(command),
    onKill: (command) => void onKill(command),
    advance: (ms) => {
      clock += ms;
    },
  };
}

test("buffers a message for a not-yet-ready agent instead of delivering it", () => {
  const h = harness();
  h.onMessage(message("a1", "hello"));
  assert.deepEqual(h.delivered, []);
});

test("flushes buffered messages in arrival order once the agent is ready", () => {
  const h = harness();
  h.onMessage(message("a1", "first"));
  h.onMessage(message("a1", "second"));
  h.buffer.markReady("a1");
  assert.deepEqual(
    h.delivered.map((command) => command.text),
    ["first", "second"],
  );
});

test("delivers straight through after the agent is ready", () => {
  const h = harness();
  h.buffer.markReady("a1");
  h.onMessage(message("a1", "live"));
  assert.deepEqual(
    h.delivered.map((command) => command.text),
    ["live"],
  );
});

test("discards buffered messages after the TTL with no spawn", () => {
  const h = harness({ ttlMs: 1000 });
  h.onMessage(message("ghost", "orphan"));
  h.advance(1001);
  h.buffer.sweep();
  h.buffer.markReady("ghost");
  assert.deepEqual(h.delivered, []);
});

test("drops the oldest message when the global cap is exceeded", () => {
  const h = harness({ maxMessages: 2 });
  h.onMessage(message("a1", "1"));
  h.onMessage(message("a2", "2"));
  h.onMessage(message("a3", "3"));
  h.buffer.markReady("a1");
  h.buffer.markReady("a2");
  h.buffer.markReady("a3");
  assert.deepEqual(
    h.delivered.map((command) => command.text),
    ["2", "3"],
  );
});

test("onKill clears the agent's buffer and still forwards the kill", () => {
  const h = harness();
  h.onMessage(message("a1", "stale"));
  h.onKill(kill("a1"));
  h.buffer.markReady("a1");
  assert.deepEqual(h.delivered, []);
  assert.deepEqual(
    h.killed.map((command) => command.agentId),
    ["a1"],
  );
});
