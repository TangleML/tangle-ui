import { afterEach, expect, it, vi } from "vitest";

import type { ToolBridgeApi } from "@/agent/toolBridgeApi";

import { AgentClient } from "./agentClient";

const remote = vi.hoisted(() => ({
  init: vi.fn(async () => {}),
  ask: vi.fn(),
  cancel: vi.fn(async () => {}),
}));
vi.mock("comlink", () => ({
  wrap: () => remote,
  proxy: <T>(value: T) => value,
}));

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

it("passes each turn's bridge without replacing the worker conversation", async () => {
  vi.stubGlobal(
    "Worker",
    class {
      terminate() {}
    },
  );
  const createWorker = vi.fn(() => new Worker("test-worker"));
  const client = new AgentClient("thread-1", createWorker, { mode: "editor" });
  const first = { setPipelineName: vi.fn() } as unknown as ToolBridgeApi;
  const next = { setPipelineName: vi.fn() } as unknown as ToolBridgeApi;
  const options = {
    message: "First",
    aiConfig: {
      apiBase: "https://api.example.com",
      apiKey: "test",
      model: "test",
    },
  };

  await client.ask({ bridge: first, onStatus: () => {} }, options);
  await client.ask(
    { bridge: next, onStatus: () => {} },
    { ...options, message: "Next" },
  );

  expect(createWorker).toHaveBeenCalledOnce();
  expect(remote.init).toHaveBeenCalledOnce();
  expect(remote.ask).toHaveBeenNthCalledWith(
    1,
    { ...options, threadId: "thread-1" },
    first,
  );
  expect(remote.ask).toHaveBeenNthCalledWith(
    2,
    { ...options, message: "Next", threadId: "thread-1" },
    next,
  );
});

it("does not start a turn if navigation aborts during worker initialization", async () => {
  vi.stubGlobal(
    "Worker",
    class {
      terminate() {}
    },
  );
  let finish = () => {};
  remote.init.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const controller = new AbortController();
  const client = new AgentClient("thread-1", () => new Worker("test-worker"), {
    mode: "editor",
  });
  const asking = client.ask(
    { bridge: {} as ToolBridgeApi, onStatus: () => {} },
    {
      message: "Edit",
      aiConfig: {
        apiBase: "https://api.example.com",
        apiKey: "test",
        model: "test",
      },
    },
    controller.signal,
  );
  controller.abort();
  finish();
  await expect(asking).rejects.toThrow();
  expect(remote.ask).not.toHaveBeenCalled();
});

it("forwards cancellation to the worker and reuses its conversation after acknowledgment", async () => {
  const terminate = vi.fn();
  const worker = { terminate } as unknown as Worker;
  const createWorker = vi.fn(() => worker);
  const client = new AgentClient("thread-1", createWorker, { mode: "editor" });
  const controller = new AbortController();
  let rejectTurn = (_reason: unknown) => {};
  remote.ask.mockImplementationOnce(
    () =>
      new Promise((_resolve, reject) => {
        rejectTurn = reject;
      }),
  );
  remote.cancel.mockImplementationOnce(async () => {
    rejectTurn(new Error("Cancelled"));
  });
  const deps = { bridge: {} as ToolBridgeApi, onStatus: () => {} };
  const options = {
    message: "Edit",
    aiConfig: {
      apiBase: "https://api.example.com",
      apiKey: "test",
      model: "test",
    },
  };
  const asking = client.ask(deps, options, controller.signal);
  await vi.waitFor(() => expect(remote.ask).toHaveBeenCalledOnce());
  controller.abort();
  await expect(asking).rejects.toThrow("Cancelled");
  expect(remote.cancel).toHaveBeenCalledOnce();
  remote.ask.mockResolvedValueOnce({
    answer: "Ready",
    componentReferences: {},
  });
  await expect(client.ask(deps, options)).resolves.toMatchObject({
    answer: "Ready",
  });
  expect(createWorker).toHaveBeenCalledOnce();
  expect(remote.init).toHaveBeenCalledOnce();
  expect(terminate).not.toHaveBeenCalled();
});
