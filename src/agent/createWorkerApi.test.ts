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
