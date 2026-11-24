import assert from "node:assert/strict";
import { test } from "node:test";

import type { ChatMessage, SubagentInfo } from "@tangent/shared/contracts.ts";

import {
  createChatState,
  PRIME_TITLE,
  tabInfos,
  withActivity,
  withAgentDelta,
  withAgentEnd,
  withAgentStart,
  withHistory,
  withHumanMessage,
  withRoster,
  workingConversations,
} from "./chatState.ts";

function message(overrides: Partial<ChatMessage>): ChatMessage {
  return {
    id: "m1",
    sessionId: "s1",
    conversationId: "c-prime",
    seq: 1,
    author: { id: "prime", kind: "agent", name: "Prime" },
    mentions: [],
    source: { kind: "agent" },
    content: "",
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function subagent(overrides: Partial<SubagentInfo>): SubagentInfo {
  return {
    id: "a1",
    conversationId: "c-a1",
    name: "Builder",
    status: "active",
    connector: {
      kind: "remote-env",
      lifecycle: "owned",
      spawnAuthority: "remote-env",
      credentialScheme: "inherited-token",
    },
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

test("withHistory buckets messages by conversation and sorts by seq", () => {
  const state = withHistory(createChatState("s1"), [
    message({ id: "m2", seq: 2, content: "second" }),
    message({ id: "m1", seq: 1, content: "first" }),
    message({ id: "m3", seq: 1, conversationId: "c-a1", content: "agent" }),
  ]);
  assert.deepEqual(
    state.conversations["c-prime"]?.messages.map((m) => m.id),
    ["m1", "m2"],
  );
  assert.equal(state.conversations["c-prime"]?.hydrated, true);
  assert.equal(state.conversations["c-a1"]?.messages[0]?.content, "agent");
});

test("withHumanMessage appends a human turn sorted by seq without going busy", () => {
  let state = withHistory(createChatState("s1"), [
    message({ id: "m1", seq: 1, content: "hello" }),
  ]);
  state = withHumanMessage(
    state,
    message({
      id: "h1",
      seq: 2,
      author: { id: "me@example.com", kind: "human", name: "me@example.com" },
      source: { kind: "human" },
      content: "hi back",
    }),
  );
  const conversation = state.conversations["c-prime"];
  assert.deepEqual(
    conversation?.messages.map((m) => m.id),
    ["m1", "h1"],
  );
  assert.equal(conversation?.messages[1]?.author.kind, "human");
  assert.equal(conversation?.busy, false);
});

test("withRoster orders the primary thread first and titles it Prime", () => {
  const state = withRoster(createChatState("s1"), "c-prime", [
    subagent({ id: "a1", conversationId: "c-a1", name: "Builder" }),
  ]);
  assert.deepEqual(state.order, ["c-prime", "c-a1"]);
  assert.equal(state.conversations["c-prime"]?.title, PRIME_TITLE);
  assert.equal(state.conversations["c-a1"]?.title, "Builder");
});

test("agent start then deltas accumulate into the message content", () => {
  let state = withAgentStart(
    createChatState("s1"),
    message({ id: "m9", content: "" }),
  );
  state = withAgentDelta(state, "m9", "Hel");
  state = withAgentDelta(state, "m9", "lo");
  assert.equal(state.conversations["c-prime"]?.messages[0]?.content, "Hello");
});

test("agent end replaces the streaming placeholder in place", () => {
  let state = withAgentStart(
    createChatState("s1"),
    message({ id: "m9", content: "partial" }),
  );
  state = withAgentEnd(state, message({ id: "m9", content: "final answer" }));
  const messages = state.conversations["c-prime"]?.messages ?? [];
  assert.equal(messages.length, 1);
  assert.equal(messages[0]?.content, "final answer");
});

test("a streaming run marks its thread working until it ends", () => {
  let state = withRoster(createChatState("s1"), "c-prime", []);
  state = withAgentStart(state, message({ id: "m9", content: "" }));
  assert.deepEqual(
    workingConversations(state).map((agent) => agent.title),
    [PRIME_TITLE],
  );

  state = withAgentEnd(state, message({ id: "m9", content: "done" }));
  assert.deepEqual(workingConversations(state), []);
});

test("activity surfaces its label and a sub-agent's working thread", () => {
  let state = withRoster(createChatState("s1"), "c-prime", [
    subagent({ id: "a1", conversationId: "c-a1", name: "Builder" }),
  ]);
  state = withActivity(state, "c-a1", {
    kind: "tool",
    label: "Running grep",
    toolName: "grep",
  });

  const working = workingConversations(state);
  assert.deepEqual(working, [
    { id: "c-a1", title: "Builder", label: "Running grep" },
  ]);
  assert.equal(
    tabInfos(state).find((tab) => tab.title === "Builder")?.busy,
    true,
  );
});

test("a completed sub-agent reads as done, not working", () => {
  const state = withRoster(createChatState("s1"), "c-prime", [
    subagent({ id: "a1", conversationId: "c-a1", status: "completed" }),
  ]);
  assert.deepEqual(workingConversations(state), []);
  assert.equal(
    tabInfos(state).find((tab) => tab.title === "Builder")?.tone,
    "done",
  );
});
