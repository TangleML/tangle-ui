import { afterEach, describe, expect, it, vi } from "vitest";

import type { TourStep } from "@/components/Learn/tours/registry";

import {
  INTERACTION_HANDLERS,
  type TourInteractionContext,
} from "./editorTourBridge.interactions";

function makeCtx(
  step: Partial<TourStep>,
  stores: { navigation?: unknown; editor?: unknown } = {},
) {
  const complete = vi.fn();
  const stopFollow = vi.fn();
  const ctx = {
    step,
    navigation: stores.navigation ?? { activeSpec: null },
    editor: stores.editor ?? { multiSelection: [] },
    windows: { getWindowById: () => undefined, getAllWindows: () => [] },
    targetWindowId: undefined,
    complete,
    stopFollow,
  } as unknown as TourInteractionContext;
  return { ctx, complete, stopFollow };
}

afterEach(() => {
  document.body.innerHTML = "";
  vi.clearAllMocks();
});

describe("handleSelectTask", () => {
  function addTaskNode(name: string) {
    const node = document.createElement("div");
    node.setAttribute("data-tour-node", "task");
    node.setAttribute("data-task-name", name);
    document.body.appendChild(node);
    return node;
  }

  it("completes when a matching task node is clicked", () => {
    const { ctx, complete } = makeCtx({
      interaction: "select-task",
      targetTaskName: "train",
    });
    const cleanup = INTERACTION_HANDLERS["select-task"](ctx);
    addTaskNode("Train XGBoost model").dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    );
    expect(complete).toHaveBeenCalledTimes(1);
    cleanup();
  });

  it("ignores clicks on a task node that does not match the target name", () => {
    const { ctx, complete } = makeCtx({
      interaction: "select-task",
      targetTaskName: "train",
    });
    const cleanup = INTERACTION_HANDLERS["select-task"](ctx);
    addTaskNode("Evaluate model").dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    );
    expect(complete).not.toHaveBeenCalled();
    cleanup();
  });
});

describe("handleSetArgument", () => {
  it("completes only when the argument is set on the targeted task", () => {
    const spec = {
      tasks: [
        { name: "train model", arguments: [{ name: "epochs", value: "10" }] },
        { name: "eval model", arguments: [{ name: "epochs", value: "" }] },
      ],
    };
    const { ctx, complete } = makeCtx(
      {
        interaction: "set-argument",
        targetArgumentName: "epochs",
        targetTaskName: "train",
      },
      { navigation: { activeSpec: spec } },
    );
    INTERACTION_HANDLERS["set-argument"](ctx);
    expect(complete).toHaveBeenCalledTimes(1);
  });

  it("does not complete when only a different task has the argument set", () => {
    const spec = {
      tasks: [
        { name: "train model", arguments: [{ name: "epochs", value: "" }] },
        { name: "eval model", arguments: [{ name: "epochs", value: "10" }] },
      ],
    };
    const { ctx, complete } = makeCtx(
      {
        interaction: "set-argument",
        targetArgumentName: "epochs",
        targetTaskName: "train",
      },
      { navigation: { activeSpec: spec } },
    );
    INTERACTION_HANDLERS["set-argument"](ctx);
    expect(complete).not.toHaveBeenCalled();
  });
});

describe("handleConnectEdge", () => {
  it("completes when the target edge already exists", () => {
    const spec = {
      tasks: [
        { $id: "s", name: "src" },
        { $id: "t", name: "dst" },
      ],
      bindings: [
        {
          sourceEntityId: "s",
          targetEntityId: "t",
          sourcePortName: "out",
          targetPortName: "in",
        },
      ],
    };
    const { ctx, complete } = makeCtx(
      {
        interaction: "connect-edge",
        targetEdge: {
          sourceTaskName: "src",
          targetTaskName: "dst",
          sourcePortName: "out",
          targetPortName: "in",
        },
      },
      { navigation: { activeSpec: spec } },
    );
    INTERACTION_HANDLERS["connect-edge"](ctx);
    expect(complete).toHaveBeenCalledTimes(1);
  });

  it("falls back to binding count and waits for a new edge when no target is given", () => {
    const spec = { tasks: [], bindings: [{}, {}] };
    const { ctx, complete } = makeCtx(
      { interaction: "connect-edge" },
      { navigation: { activeSpec: spec } },
    );
    INTERACTION_HANDLERS["connect-edge"](ctx);
    expect(complete).not.toHaveBeenCalled();
  });
});

describe("handleAddTask", () => {
  it("waits for a new matching task rather than completing on entry", () => {
    const spec = { tasks: [{ name: "train model" }] };
    const { ctx, complete } = makeCtx(
      { interaction: "add-task", targetTaskName: "train" },
      { navigation: { activeSpec: spec } },
    );
    INTERACTION_HANDLERS["add-task"](ctx);
    expect(complete).not.toHaveBeenCalled();
  });
});

describe("selector-based handlers", () => {
  it("completes immediately when the secret dialog is already present", () => {
    const dialog = document.createElement("div");
    dialog.setAttribute("data-testid", "select-secret-dialog");
    document.body.appendChild(dialog);

    const { ctx, complete } = makeCtx({ interaction: "open-secret-dialog" });
    INTERACTION_HANDLERS["open-secret-dialog"](ctx);
    expect(complete).toHaveBeenCalledTimes(1);
  });

  it("does not complete when the targeted dialog is absent", () => {
    const { ctx, complete } = makeCtx({ interaction: "open-submit-dialog" });
    const cleanup = INTERACTION_HANDLERS["open-submit-dialog"](ctx);
    expect(complete).not.toHaveBeenCalled();
    cleanup();
  });
});
