import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CMD_OR_CTRL } from "@/routes/v2/shared/shortcuts/keys";
import { KeyboardStore } from "@/routes/v2/shared/store/keyboardStore";

import { useFocusMode } from "./useFocusMode";

const stores = vi.hoisted(() => ({
  keyboard: {} as KeyboardStore,
  windows: { applyViewPreset: vi.fn() },
}));

vi.mock("@/routes/v2/shared/store/SharedStoreContext", () => ({
  useSharedStores: () => stores,
}));

describe("useFocusMode", () => {
  it("leaves Cmd/Ctrl+D to Duplicate when the canvas registers it first", () => {
    stores.keyboard = new KeyboardStore({ isMac: false });
    stores.keyboard.registerShortcut({
      id: "duplicate",
      keys: [CMD_OR_CTRL, "D"],
      label: "Duplicate",
      action: vi.fn(),
    });

    renderHook(() => useFocusMode());

    expect(stores.keyboard.getShortcut("duplicate")).toBeDefined();
    expect(stores.keyboard.getShortcut("default-layout")).toBeDefined();
  });
});
