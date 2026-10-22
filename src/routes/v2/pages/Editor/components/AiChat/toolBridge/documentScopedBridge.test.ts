import { expect, it, vi } from "vitest";

import { ComponentSpec } from "@/models/componentSpec";
import { createDocumentScopedBridge } from "@/routes/v2/shared/components/AiChat/toolBridge/documentScopedBridge";
import { hydrateComponentReference } from "@/services/componentService";

import { createEditorToolBridge } from ".";

vi.mock("@/services/componentService", () => ({
  hydrateComponentReference: vi.fn(),
  fetchAndStoreComponentLibrary: vi.fn(),
}));
vi.mock("@/utils/submitPipeline", () => ({ submitPipelineRun: vi.fn() }));

function setup(onPipelineRenamed?: (name: string) => Promise<void>) {
  const first = new ComponentSpec({ name: "First" });
  const second = new ComponentSpec({ name: "Second" });
  let active = first;
  const controller = new AbortController();
  const createBridge = (signal: AbortSignal) =>
    createDocumentScopedBridge(
      (deps) =>
        createEditorToolBridge({
          ...deps,
          undo: { withGroup: (_label, fn) => fn() },
          onPipelineRenamed,
        }),
      {
        getSpec: () => active,
        getActiveSubgraphPath: () => [],
        getActiveSubgraphTaskId: () => undefined,
      },
      signal,
    );
  return {
    first,
    second,
    controller,
    bridge: createBridge(controller.signal),
    createBridge,
    navigate: (spec: ComponentSpec) => {
      active = spec;
    },
  };
}

it("rejects an old turn after navigation and lets a new turn edit the new document", async () => {
  const { bridge, first, second, navigate, createBridge } = setup();
  navigate(second);
  await expect(bridge.setPipelineDescription("Old turn")).rejects.toThrow(
    "open pipeline changed",
  );
  expect(first.description).toBeUndefined();
  expect(second.description).toBeUndefined();

  const next = createBridge(new AbortController().signal);
  await next.setPipelineDescription("New turn");
  expect(second.description).toBe("New turn");
});

it("keeps an aborted turn blocked when the original document is reopened", async () => {
  const { bridge, controller, first, second, navigate } = setup();
  controller.abort();
  navigate(second);
  navigate(first);
  await expect(bridge.setPipelineDescription("Old turn")).rejects.toThrow();
  expect(first.description).toBeUndefined();
});

it("rejects a task hydration that completes after navigation", async () => {
  let finish = () => {};
  const pending = new Promise<void>((resolve) => {
    finish = resolve;
  });
  vi.mocked(hydrateComponentReference).mockImplementationOnce(async () => {
    await pending;
    return null;
  });
  const { bridge, first, second, navigate } = setup();
  const adding = bridge.addTask({
    name: "Late task",
    componentRef: {
      spec: {
        name: "Task",
        implementation: { container: { image: "example:1" } },
      },
    },
  });
  navigate(second);
  finish();
  await expect(adding).rejects.toThrow("open pipeline changed");
  expect(first.tasks).toHaveLength(0);
  expect(second.tasks).toHaveLength(0);
});

it("keeps a saved rename on its original document when navigation interrupts the turn", async () => {
  let finish = () => {};
  const pending = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const { bridge, first, second, navigate } = setup(async () => {
    await pending;
  });
  const renaming = bridge.setPipelineName("Late name");
  navigate(second);
  finish();
  await expect(renaming).rejects.toThrow("open pipeline changed");
  expect(first.name).toBe("Late name");
  expect(second.name).toBe("Second");
});
