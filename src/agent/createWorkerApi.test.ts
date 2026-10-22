import { expect, it, vi } from "vitest";

import type { TangleDispatcher } from "./agents/dispatcherRuntime";
import { createWorkerApi } from "./createWorkerApi";
import type { ToolBridgeApi } from "./toolBridgeApi";

it("uses the current turn bridge while retaining the dispatcher conversation", async () => {
  const bridges: ToolBridgeApi[] = [];
  const createDispatcher = vi.fn(() => ({
    invoke: vi.fn(
      async ({
        session,
        threadId,
      }: Parameters<TangleDispatcher["invoke"]>[0]) => {
        bridges.push(session.bridge);
        return { answer: `Turn ${bridges.length}`, threadId };
      },
    ),
    dispose: vi.fn(),
  }));
  const api = createWorkerApi(createDispatcher);
  const initial = {} as ToolBridgeApi;
  const next = {} as ToolBridgeApi;
  api.init(initial, () => {}, { mode: "editor" });
  const params = {
    message: "Edit",
    threadId: "thread-1",
    aiConfig: {
      apiBase: "https://api.example.com",
      apiKey: "test",
      model: "test",
    },
  };

  expect((await api.ask(params, initial)).answer).toBe("Turn 1");
  expect((await api.ask(params, next)).answer).toBe("Turn 2");
  expect(bridges).toEqual([initial, next]);
  expect(createDispatcher).toHaveBeenCalledOnce();
});

it("cancels the active dispatcher request without disposing its conversation", async () => {
  let signal: AbortSignal | undefined;
  const dispatcher = {
    invoke: vi.fn(
      ({ signal: turnSignal }: Parameters<TangleDispatcher["invoke"]>[0]) => {
        signal = turnSignal;
        return new Promise<{ answer: string; threadId: string }>(
          (_resolve, reject) => {
            signal?.addEventListener(
              "abort",
              () => reject(new Error("Cancelled")),
              { once: true },
            );
          },
        );
      },
    ),
    dispose: vi.fn(),
  };
  const api = createWorkerApi(() => dispatcher);
  api.init({} as ToolBridgeApi, () => {}, { mode: "editor" });
  const params = {
    message: "Edit",
    threadId: "thread-1",
    aiConfig: {
      apiBase: "https://api.example.com",
      apiKey: "test",
      model: "test",
    },
  };
  const asking = api.ask(params);
  expect(signal?.aborted).toBe(false);
  api.cancel();
  await expect(asking).rejects.toThrow("Cancelled");
  expect(signal?.aborted).toBe(true);
  dispatcher.invoke.mockResolvedValueOnce({
    answer: "Ready",
    threadId: "thread-1",
  });
  await expect(api.ask(params)).resolves.toMatchObject({ answer: "Ready" });
  expect(signal?.aborted).toBe(true);
  expect(dispatcher.dispose).not.toHaveBeenCalled();
});
