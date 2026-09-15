import type { Remote } from "comlink";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RemoteEnvWorkerApi } from "@/agent/createRemoteEnvWorkerApi";

import { createRemoteEnvHost } from "./remoteEnvHost";

type CommandHandler = (command: unknown) => unknown;

interface FakeClient {
  socket: { on: ReturnType<typeof vi.fn> };
  agentEvent: ReturnType<typeof vi.fn>;
  subagentUpdate: ReturnType<typeof vi.fn>;
  report: ReturnType<typeof vi.fn>;
  readRoom: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
}

interface ConnectOptions {
  url: string;
  socketPath?: string;
  handlers: Record<string, CommandHandler>;
}

const mockState = vi.hoisted(() => ({
  handlers: null as Record<string, CommandHandler> | null,
  client: null as FakeClient | null,
  options: null as ConnectOptions | null,
}));

vi.mock("@tangent/remote-subagent", () => ({
  connectRemoteEnvironment: (options: ConnectOptions) => {
    mockState.handlers = options.handlers;
    mockState.options = options;
    return mockState.client;
  },
}));

interface EventCall {
  event: { type: string };
  runId?: string;
}

function makeClient(): FakeClient {
  return {
    socket: { on: vi.fn() },
    agentEvent: vi.fn(),
    subagentUpdate: vi.fn(),
    report: vi.fn(),
    readRoom: vi.fn(),
    disconnect: vi.fn(),
  };
}

function makeWorker(runTurnImpl?: () => Promise<{ answer: string }>) {
  const worker = {
    spawnAgent: vi.fn(),
    runTurn: vi.fn(
      async (
        _params: unknown,
        onStatus: (status: { text: string }) => void,
      ) => {
        onStatus({ text: "Adding task..." });
        return runTurnImpl ? runTurnImpl() : { answer: "done" };
      },
    ),
    abortAgent: vi.fn(),
    killAgent: vi.fn(),
  };
  return worker as unknown as Remote<RemoteEnvWorkerApi> & typeof worker;
}

function eventCalls(client: FakeClient): EventCall[] {
  return client.agentEvent.mock.calls.map((call) => ({
    event: call[2],
    runId: call[3],
  }));
}

describe("createRemoteEnvHost", () => {
  let client: FakeClient;

  beforeEach(() => {
    mockState.handlers = null;
    mockState.options = null;
    client = makeClient();
    mockState.client = client;
  });

  it("splits a mounted-prefix baseUrl into origin url and prefixed socket path", () => {
    const worker = makeWorker();
    const host = createRemoteEnvHost({
      url: "https://oasis-staging.shopify.io/tangent",
      worker,
    });
    host.connect("token", "env-1");

    expect(mockState.options?.url).toBe("https://oasis-staging.shopify.io");
    expect(mockState.options?.socketPath).toBe("/tangent/socket.io");
  });

  it("uses the default socket path for a bare origin baseUrl", () => {
    const worker = makeWorker();
    const host = createRemoteEnvHost({ url: "http://localhost:5173", worker });
    host.connect("token", "env-1");

    expect(mockState.options?.url).toBe("http://localhost:5173");
    expect(mockState.options?.socketPath).toBe("/socket.io");
  });

  it("spawns an agent and marks it active on onSpawn", async () => {
    const worker = makeWorker();
    const host = createRemoteEnvHost({ url: "http://tangent", worker });
    host.connect("token", "env-1");

    await mockState.handlers?.onSpawn({
      sessionId: "s1",
      agentId: "a1",
      name: "editor",
      tools: ["add_task"],
      systemPrompt: "do it",
      autoRelayToPrime: true,
    });

    expect(worker.spawnAgent).toHaveBeenCalledWith({
      agentId: "a1",
      tools: ["add_task"],
      systemPrompt: "do it",
    });
    expect(client.subagentUpdate).toHaveBeenCalledWith("s1", "a1", "active");
  });

  it("streams start -> activity -> end carrying the answer, echoing runId, without a separate report", async () => {
    const worker = makeWorker(async () => ({ answer: "added the task" }));
    const host = createRemoteEnvHost({ url: "http://tangent", worker });
    host.connect("token", "env-1");

    await mockState.handlers?.onMessage({
      sessionId: "s1",
      agentId: "a1",
      text: "add a task",
      delivery: "auto",
      runId: "run-1",
    });

    const calls = eventCalls(client);
    expect(calls.map((c) => c.event.type)).toEqual([
      "start",
      "activity",
      "end",
      "activity",
    ]);
    expect(calls.every((c) => c.runId === "run-1")).toBe(true);
    const endEvent = calls.find((c) => c.event.type === "end")?.event;
    expect(endEvent).toMatchObject({ content: "added the task" });
    // The `end` event is the whole turn; a separate `report()` would duplicate
    // it for Prime, so the host must not send one.
    expect(client.report).not.toHaveBeenCalled();
  });

  it("emits an error event and error status when a turn throws", async () => {
    const worker = makeWorker(async () => {
      throw new Error("boom");
    });
    const onError = vi.fn();
    const host = createRemoteEnvHost({
      url: "http://tangent",
      worker,
      onError,
    });
    host.connect("token", "env-1");

    await mockState.handlers?.onMessage({
      sessionId: "s1",
      agentId: "a1",
      text: "add a task",
      delivery: "auto",
      runId: "run-1",
    });

    const errorEvent = eventCalls(client).find((c) => c.event.type === "error");
    expect(errorEvent).toBeDefined();
    expect(client.subagentUpdate).toHaveBeenCalledWith("s1", "a1", "error");
    expect(onError).toHaveBeenCalledWith("boom");
  });

  it("kills an agent and reports the terminal status", async () => {
    const worker = makeWorker();
    const host = createRemoteEnvHost({ url: "http://tangent", worker });
    host.connect("token", "env-1");

    await mockState.handlers?.onKill({
      sessionId: "s1",
      agentId: "a1",
      completed: false,
    });

    expect(worker.killAgent).toHaveBeenCalledWith("a1");
    expect(client.subagentUpdate).toHaveBeenCalledWith("s1", "a1", "killed");
  });
});
