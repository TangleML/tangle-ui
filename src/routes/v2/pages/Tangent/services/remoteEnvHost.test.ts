import type {
  RemoteKillCommand,
  RemoteMessageCommand,
  RemoteSpawnCommand,
} from "@tangent/remote-subagent";
import type { Remote } from "comlink";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { RemoteEnvWorkerApi } from "@/agent/createRemoteEnvWorkerApi";

import { createRemoteEnvHost } from "./remoteEnvHost";

const connectRemoteEnvironment = vi.fn();

vi.mock("@tangent/remote-subagent", () => ({
  connectRemoteEnvironment: (options: unknown) =>
    connectRemoteEnvironment(options),
}));

interface FakeClient {
  agentEvent: ReturnType<typeof vi.fn>;
  subagentUpdate: ReturnType<typeof vi.fn>;
  report: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  socket: { id: string; connected: boolean; on: ReturnType<typeof vi.fn> };
}

function createFakeClient(): FakeClient {
  return {
    agentEvent: vi.fn(),
    subagentUpdate: vi.fn(),
    report: vi.fn(),
    disconnect: vi.fn(),
    socket: { id: "sock-1", connected: false, on: vi.fn() },
  };
}

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
}

function defer<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function spawnCommand(agentId: string): RemoteSpawnCommand {
  return {
    sessionId: "s1",
    agentId,
    name: "editor",
    tools: [],
    systemPrompt: "",
    autoRelayToPrime: true,
  };
}

function messageCommand(agentId: string, text: string): RemoteMessageCommand {
  return { sessionId: "s1", agentId, text, delivery: "auto", runId: "r1" };
}

function killCommand(agentId: string, completed: boolean): RemoteKillCommand {
  return { sessionId: "s1", agentId, completed };
}

function captureHandlers() {
  const options = connectRemoteEnvironment.mock.calls.at(-1)?.[0];
  return options.handlers;
}

function makeWorker() {
  return {
    init: vi.fn(),
    setAiConfig: vi.fn(),
    setContext: vi.fn(),
    ping: vi.fn(),
    spawnAgent: vi.fn().mockResolvedValue(undefined),
    runTurn: vi.fn(),
    abortAgent: vi.fn(),
    killAgent: vi.fn().mockResolvedValue(undefined),
  };
}

describe("createRemoteEnvHost", () => {
  let client: FakeClient;

  beforeEach(() => {
    client = createFakeClient();
    connectRemoteEnvironment.mockReset();
    connectRemoteEnvironment.mockReturnValue(client);
    vi.spyOn(console, "info").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  function connectedHost(worker: ReturnType<typeof makeWorker>) {
    const onError = vi.fn();
    const host = createRemoteEnvHost({
      url: "http://localhost:8000",
      worker: worker as unknown as Remote<RemoteEnvWorkerApi>,
      onError,
    });
    void host.connect("token", "env-1");
    return { host, onError, handlers: captureHandlers() };
  }

  it("resolves connect only after the socket is connected", async () => {
    const worker = makeWorker();
    const host = createRemoteEnvHost({
      url: "http://localhost:8000",
      worker: worker as unknown as Remote<RemoteEnvWorkerApi>,
    });

    const connection = host.connect("token", "env-1");
    let connected = false;
    void connection.then(() => {
      connected = true;
    });
    await Promise.resolve();
    expect(connected).toBe(false);

    const connectListener = client.socket.on.mock.calls.find(
      ([event]) => event === "connect",
    )?.[1];
    if (!connectListener)
      throw new Error("Connect listener was not registered");
    connectListener();
    await expect(connection).resolves.toBeUndefined();
  });

  it("settles a connect that a disconnect superseded", async () => {
    const worker = makeWorker();
    const host = createRemoteEnvHost({
      url: "http://localhost:8000",
      worker: worker as unknown as Remote<RemoteEnvWorkerApi>,
    });

    const connection = host.connect("token", "env-1");
    const connectListener = client.socket.on.mock.calls.find(
      ([event]) => event === "connect",
    )?.[1];
    if (!connectListener)
      throw new Error("Connect listener was not registered");

    // Teardown drops the client this promise was created for. The caller
    // awaits it before scheduling the next token refresh, so it has to settle.
    host.disconnect();
    connectListener();

    await expect(connection).resolves.toBeUndefined();
  });

  it("settles a superseded connect that then errors", async () => {
    const worker = makeWorker();
    const host = createRemoteEnvHost({
      url: "http://localhost:8000",
      worker: worker as unknown as Remote<RemoteEnvWorkerApi>,
    });

    const connection = host.connect("token", "env-1");
    const errorListener = client.socket.on.mock.calls.find(
      ([event]) => event === "connect_error",
    )?.[1];
    if (!errorListener)
      throw new Error("connect_error listener was not registered");

    host.disconnect();
    errorListener(new Error("boom"));

    await expect(connection).resolves.toBeUndefined();
  });

  it("logs the shape of tool-call arguments, never the payload", () => {
    const worker = makeWorker();
    const host = createRemoteEnvHost({
      url: "http://localhost:8000",
      worker: worker as unknown as Remote<RemoteEnvWorkerApi>,
    });

    void host.connect("token", "env-1");
    const callListener = client.socket.on.mock.calls.find(
      ([event]) => event === "remote:tools:call",
    )?.[1];
    if (!callListener) throw new Error("Tool-call listener was not registered");

    callListener({
      name: "set_pipeline",
      arguments: { pipeline: "secret-pipeline-yaml", nodeId: "n1" },
    });

    const logged = vi
      .mocked(console.info)
      .mock.calls.map((args) => args.join(" "))
      .join("\n");
    expect(logged).toContain("pipeline, nodeId");
    expect(logged).not.toContain("secret-pipeline-yaml");
  });

  it("emits start then a single end (never report) for a completed turn", async () => {
    const worker = makeWorker();
    worker.runTurn.mockResolvedValue({ answer: "done" });
    const { handlers } = connectedHost(worker);
    await handlers.onSpawn(spawnCommand("a1"));

    await handlers.onMessage(messageCommand("a1", "hello"));

    const eventTypes = client.agentEvent.mock.calls.map((call) => call[2].type);
    expect(eventTypes).toContain("start");
    const endCall = client.agentEvent.mock.calls.find(
      (call) => call[2].type === "end",
    );
    expect(endCall?.[2]).toMatchObject({ content: "done" });
    expect(client.report).not.toHaveBeenCalled();
    expect(client.subagentUpdate).not.toHaveBeenCalledWith("s1", "a1", "error");
  });

  it("emits an immediate placeholder delta after start and before end", async () => {
    const worker = makeWorker();
    worker.runTurn.mockResolvedValue({ answer: "done" });
    const { handlers } = connectedHost(worker);
    await handlers.onSpawn(spawnCommand("a1"));

    await handlers.onMessage(messageCommand("a1", "hello"));

    const events = client.agentEvent.mock.calls;
    const startIndex = events.findIndex((call) => call[2].type === "start");
    const deltaIndex = events.findIndex((call) => call[2].type === "delta");
    const endIndex = events.findIndex((call) => call[2].type === "end");

    expect(startIndex).toBeGreaterThanOrEqual(0);
    expect(deltaIndex).toBeGreaterThan(startIndex);
    expect(deltaIndex).toBeLessThan(endIndex);

    const startCall = events[startIndex];
    const deltaCall = events[deltaIndex];
    expect(deltaCall[2]).toMatchObject({
      type: "delta",
      messageId: startCall[2].messageId,
      delta: expect.stringContaining("Working on it"),
    });
    expect(deltaCall[3]).toBe("r1");
  });

  it("serializes turns per agentId", async () => {
    const worker = makeWorker();
    const first = defer<{ answer: string }>();
    const second = defer<{ answer: string }>();
    worker.runTurn
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const { handlers } = connectedHost(worker);
    await handlers.onSpawn(spawnCommand("a1"));

    void handlers.onMessage(messageCommand("a1", "one"));
    void handlers.onMessage(messageCommand("a1", "two"));
    await Promise.resolve();

    expect(worker.runTurn).toHaveBeenCalledTimes(1);

    first.resolve({ answer: "one" });
    await vi.waitFor(() => expect(worker.runTurn).toHaveBeenCalledTimes(2));
    second.resolve({ answer: "two" });
  });

  it("drops queued turns when the agent is killed", async () => {
    const worker = makeWorker();
    const first = defer<{ answer: string }>();
    worker.runTurn.mockReturnValueOnce(first.promise);
    const { handlers, onError } = connectedHost(worker);
    await handlers.onSpawn(spawnCommand("a1"));

    const firstTurn = handlers.onMessage(messageCommand("a1", "one"));
    const queuedTurn = handlers.onMessage(messageCommand("a1", "two"));
    await vi.waitFor(() => expect(worker.runTurn).toHaveBeenCalledOnce());
    await handlers.onKill(killCommand("a1", false));

    const abortError = new Error("aborted");
    abortError.name = "AbortError";
    first.reject(abortError);
    await Promise.all([firstTurn, queuedTurn]);

    expect(worker.runTurn).toHaveBeenCalledOnce();
    expect(onError).not.toHaveBeenCalled();
  });

  it("drops queued turns when the host disconnects", async () => {
    const worker = makeWorker();
    const first = defer<{ answer: string }>();
    worker.runTurn.mockReturnValueOnce(first.promise);
    const { host, handlers, onError } = connectedHost(worker);
    await handlers.onSpawn(spawnCommand("a1"));

    const firstTurn = handlers.onMessage(messageCommand("a1", "one"));
    const queuedTurn = handlers.onMessage(messageCommand("a1", "two"));
    await vi.waitFor(() => expect(worker.runTurn).toHaveBeenCalledOnce());
    host.disconnect();

    first.reject(new Error("terminated"));
    await Promise.all([firstTurn, queuedTurn]);

    expect(worker.runTurn).toHaveBeenCalledOnce();
    expect(onError).not.toHaveBeenCalled();
  });

  it("keeps respawned agent bookkeeping isolated from an old aborted turn", async () => {
    const worker = makeWorker();
    const oldTurn = defer<{ answer: string }>();
    const newTurn = defer<{ answer: string }>();
    worker.runTurn
      .mockReturnValueOnce(oldTurn.promise)
      .mockReturnValueOnce(newTurn.promise);
    const { host, handlers } = connectedHost(worker);
    await handlers.onSpawn(spawnCommand("a1"));
    const oldRun = handlers.onMessage(messageCommand("a1", "old"));
    await vi.waitFor(() => expect(worker.runTurn).toHaveBeenCalledOnce());

    await handlers.onKill(killCommand("a1", false));
    await handlers.onSpawn(spawnCommand("a1"));
    const newRun = handlers.onMessage(messageCommand("a1", "new"));
    await vi.waitFor(() => expect(worker.runTurn).toHaveBeenCalledTimes(2));

    const abortError = new Error("aborted");
    abortError.name = "AbortError";
    oldTurn.reject(abortError);
    await oldRun;
    host.disconnect();

    expect(worker.abortAgent).toHaveBeenCalledWith("a1");
    newTurn.reject(abortError);
    await newRun;
  });

  it("treats a kill-aborted turn as cancellation, not an error", async () => {
    const worker = makeWorker();
    const turn = defer<{ answer: string }>();
    worker.runTurn.mockReturnValue(turn.promise);
    const { handlers, onError } = connectedHost(worker);
    await handlers.onSpawn(spawnCommand("a1"));

    void handlers.onMessage(messageCommand("a1", "hello"));
    await Promise.resolve();

    await handlers.onKill(killCommand("a1", false));
    const abortError = new Error("aborted");
    abortError.name = "AbortError";
    turn.reject(abortError);
    await turn.promise.catch(() => undefined);
    await Promise.resolve();

    expect(client.subagentUpdate).toHaveBeenCalledWith("s1", "a1", "killed");
    expect(client.subagentUpdate).not.toHaveBeenCalledWith("s1", "a1", "error");
    const errorEvents = client.agentEvent.mock.calls.filter(
      (call) => call[2].type === "error",
    );
    expect(errorEvents).toHaveLength(0);
    expect(onError).not.toHaveBeenCalled();
  });

  it("reports a genuine turn failure as an error", async () => {
    const worker = makeWorker();
    worker.runTurn.mockRejectedValue(new Error("model exploded"));
    const { handlers, onError } = connectedHost(worker);
    await handlers.onSpawn(spawnCommand("a1"));

    await handlers.onMessage(messageCommand("a1", "hello"));
    await Promise.resolve();

    const errorEvent = client.agentEvent.mock.calls.find(
      (call) => call[2].type === "error",
    );
    expect(errorEvent?.[2]).toMatchObject({ message: "model exploded" });
    expect(client.subagentUpdate).toHaveBeenCalledWith("s1", "a1", "error");
    expect(onError).toHaveBeenCalledWith("model exploded");
  });

  it("finalizes the placeholder with empty content when a turn fails", async () => {
    const worker = makeWorker();
    worker.runTurn.mockRejectedValue(new Error("model exploded"));
    const { handlers } = connectedHost(worker);
    await handlers.onSpawn(spawnCommand("a1"));

    await handlers.onMessage(messageCommand("a1", "hello"));
    await Promise.resolve();

    const events = client.agentEvent.mock.calls;
    const startCall = events.find((call) => call[2].type === "start");
    const endCall = events.find((call) => call[2].type === "end");
    expect(endCall?.[2]).toMatchObject({
      type: "end",
      messageId: startCall?.[2].messageId,
      content: "",
    });
    const endIndex = events.findIndex((call) => call[2].type === "end");
    const errorIndex = events.findIndex((call) => call[2].type === "error");
    expect(endIndex).toBeLessThan(errorIndex);
  });

  it("finalizes the placeholder when a kill aborts the turn", async () => {
    const worker = makeWorker();
    const turn = defer<{ answer: string }>();
    worker.runTurn.mockReturnValue(turn.promise);
    const { handlers } = connectedHost(worker);
    await handlers.onSpawn(spawnCommand("a1"));

    void handlers.onMessage(messageCommand("a1", "hello"));
    await Promise.resolve();

    // onKill drops the lifecycle, so this also covers the staleness guard:
    // the turn's own messageId still has to be finalized.
    await handlers.onKill(killCommand("a1", false));
    const abortError = new Error("aborted");
    abortError.name = "AbortError";
    turn.reject(abortError);
    await turn.promise.catch(() => undefined);
    await Promise.resolve();

    const startCall = client.agentEvent.mock.calls.find(
      (call) => call[2].type === "start",
    );
    const endCall = client.agentEvent.mock.calls.find(
      (call) => call[2].type === "end",
    );
    expect(endCall?.[2]).toMatchObject({
      messageId: startCall?.[2].messageId,
      content: "",
    });
  });

  it("does not toast when an in-flight turn is aborted by disconnect", async () => {
    const worker = makeWorker();
    const turn = defer<{ answer: string }>();
    worker.runTurn.mockReturnValue(turn.promise);
    const { host, handlers, onError } = connectedHost(worker);
    await handlers.onSpawn(spawnCommand("a1"));

    void handlers.onMessage(messageCommand("a1", "hello"));
    await Promise.resolve();

    host.disconnect();
    expect(worker.abortAgent).toHaveBeenCalledWith("a1");

    turn.reject(new Error("aborted mid-flight"));
    await turn.promise.catch(() => undefined);
    await Promise.resolve();

    expect(onError).not.toHaveBeenCalled();
  });

  it("forwards spawn and kill to the worker with subagent roster updates", async () => {
    const worker = makeWorker();
    const { handlers } = connectedHost(worker);

    await handlers.onSpawn(spawnCommand("a1"));
    expect(worker.spawnAgent).toHaveBeenCalledWith(
      expect.objectContaining({ agentId: "a1", tools: [], systemPrompt: "" }),
    );
    expect(client.subagentUpdate).toHaveBeenCalledWith("s1", "a1", "active");

    await handlers.onKill(killCommand("a1", true));
    expect(worker.killAgent).toHaveBeenCalledWith("a1");
    expect(client.subagentUpdate).toHaveBeenCalledWith("s1", "a1", "completed");
  });

  it("forwards the token, environmentId, and sessionId and wraps tools without changing the catalog", async () => {
    const worker = makeWorker();
    const echo = vi.fn().mockResolvedValue("echoed");
    const tools = {
      echo: {
        description: "echo",
        inputSchema: { type: "object", properties: {} },
        execute: echo,
      },
    };
    const host = createRemoteEnvHost({
      url: "http://localhost:8000",
      worker: worker as unknown as Remote<RemoteEnvWorkerApi>,
      tools,
      sessionId: "s1",
    });

    void host.connect("token", "env-1");

    const options = connectRemoteEnvironment.mock.calls.at(-1)?.[0];
    expect(options).toMatchObject({
      token: "token",
      environmentId: "env-1",
      sessionId: "s1",
    });
    expect(Object.keys(options.tools)).toEqual(["echo"]);
    expect(options.tools.echo).toMatchObject({
      description: "echo",
      inputSchema: tools.echo.inputSchema,
    });

    await expect(options.tools.echo.execute({ n: 1 })).resolves.toBe("echoed");
    expect(echo).toHaveBeenCalledWith({ n: 1 });
  });

  it("logs the socket name used for a remote tool call", async () => {
    const worker = makeWorker();
    const tools = {
      echo: {
        description: "echo",
        inputSchema: { type: "object", properties: {} },
        execute: vi.fn().mockResolvedValue("echoed"),
      },
    };
    const host = createRemoteEnvHost({
      url: "http://localhost:8000",
      worker: worker as unknown as Remote<RemoteEnvWorkerApi>,
      tools,
      sessionId: "s1",
    });

    void host.connect("token", "env-1");
    const options = connectRemoteEnvironment.mock.calls.at(-1)?.[0];
    await options.tools.echo.execute({ n: 1 });

    const logged = vi.mocked(console.info).mock.calls.map(([line]) => line);
    expect(
      logged.some(
        (line) =>
          typeof line === "string" &&
          line.includes("socket sock-1") &&
          line.includes("tool start echo"),
      ),
    ).toBe(true);
  });

  it("registers diagnostic listeners for disconnect and remote tool calls", () => {
    const worker = makeWorker();
    connectedHost(worker);

    const registeredEvents = client.socket.on.mock.calls.map(
      ([event]) => event,
    );
    expect(registeredEvents).toContain("disconnect");
    expect(registeredEvents).toContain("remote:tools:call");
  });

  it("surfaces spawn and kill worker failures", async () => {
    const worker = makeWorker();
    const { handlers, onError } = connectedHost(worker);
    worker.spawnAgent.mockRejectedValueOnce(new Error("spawn failed"));

    await handlers.onSpawn(spawnCommand("a1"));

    expect(client.subagentUpdate).toHaveBeenCalledWith("s1", "a1", "error");
    expect(onError).toHaveBeenCalledWith("spawn failed");

    worker.killAgent.mockRejectedValueOnce(new Error("kill failed"));
    await handlers.onKill(killCommand("a1", false));

    expect(onError).toHaveBeenCalledWith("kill failed");
  });
});
