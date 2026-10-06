import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ComponentSpec } from "@/models/componentSpec";
import { copyNodesToClipboard } from "@/routes/v2/shared/clipboard/copyNodesToClipboard";
import { getEffectiveSelection } from "@/routes/v2/shared/clipboard/getEffectiveSelection";
import type { NodeTypeRegistry } from "@/routes/v2/shared/nodes/registry";
import { EditorStore } from "@/routes/v2/shared/store/editorStore";
import { KeyboardStore } from "@/routes/v2/shared/store/keyboardStore";

import { useCopyShortcut } from "./useCopyShortcut";

const registry = {} as NodeTypeRegistry;
const stores = { editor: new EditorStore(), keyboard: new KeyboardStore() };

vi.mock("@/hooks/useToastNotification", () => ({ default: () => vi.fn() }));

vi.mock("@/routes/v2/shared/nodes/NodeRegistryContext", () => ({
  useNodeRegistry: () => registry,
}));

vi.mock("@/routes/v2/shared/store/SharedStoreContext", () => ({
  useSharedStores: () => stores,
}));

vi.mock("@/routes/v2/shared/clipboard/copyNodesToClipboard", () => ({
  copyNodesToClipboard: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/routes/v2/shared/clipboard/getEffectiveSelection", () => ({
  getEffectiveSelection: vi.fn(),
}));

const spec = new ComponentSpec({ name: "Churn model" });

function selectedNode() {
  return [{ id: "train", type: "task" as const, position: { x: 0, y: 0 } }];
}

function selectMessageText() {
  const message = document.body.appendChild(document.createElement("p"));
  message.textContent = "the run failed on step two";
  const range = document.createRange();
  range.selectNodeContents(message);
  window.getSelection()?.addRange(range);
}

function pressCopy(pipelineSpec: ComponentSpec | null = spec) {
  renderHook(() => useCopyShortcut(pipelineSpec));

  const event = new KeyboardEvent("keydown", { key: "c", metaKey: true });
  const preventDefault = vi.spyOn(event, "preventDefault");
  const handled = stores.keyboard.getShortcut("copy")?.action(event);

  return { handled, preventDefault };
}

describe("useCopyShortcut", () => {
  beforeEach(() => {
    vi.mocked(getEffectiveSelection).mockReturnValue(selectedNode());
  });

  afterEach(() => {
    vi.clearAllMocks();
    window.getSelection()?.removeAllRanges();
    document.body.replaceChildren();
  });

  it("copies the selected nodes", () => {
    const { handled, preventDefault } = pressCopy();

    expect(preventDefault).toHaveBeenCalled();
    expect(handled).not.toBe(false);
    expect(copyNodesToClipboard).toHaveBeenCalledWith(
      registry,
      spec,
      selectedNode(),
    );
  });

  it("leaves the copy to the browser when text is selected", () => {
    selectMessageText();
    const { handled, preventDefault } = pressCopy();

    expect(handled).toBe(false);
    expect(preventDefault).not.toHaveBeenCalled();
    expect(copyNodesToClipboard).not.toHaveBeenCalled();
  });

  it("leaves the copy to the browser when no node is selected", () => {
    vi.mocked(getEffectiveSelection).mockReturnValue([]);
    const { handled, preventDefault } = pressCopy();

    expect(handled).toBe(false);
    expect(preventDefault).not.toHaveBeenCalled();
    expect(copyNodesToClipboard).not.toHaveBeenCalled();
  });

  it("leaves the copy to the browser without a spec", () => {
    const { handled, preventDefault } = pressCopy(null);

    expect(handled).toBe(false);
    expect(preventDefault).not.toHaveBeenCalled();
    expect(copyNodesToClipboard).not.toHaveBeenCalled();
  });
});
