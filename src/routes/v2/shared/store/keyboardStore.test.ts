import { describe, expect, it, vi } from "vitest";

import { CMD_OR_CTRL } from "@/routes/v2/shared/shortcuts/keys";

import { KeyboardStore } from "./keyboardStore";

function registerUndo(keyboard: KeyboardStore, id: string) {
  return keyboard.registerShortcut({
    id,
    keys: [CMD_OR_CTRL, "Z"],
    label: "Undo",
    action: vi.fn(),
  });
}

describe("KeyboardStore", () => {
  it("removes a shortcut when it is unregistered", () => {
    const keyboard = new KeyboardStore();
    const unregister = registerUndo(keyboard, "undo");

    unregister();

    expect(keyboard.getShortcut("undo")).toBeUndefined();
  });

  it("keeps a newer registration of the same combo when the older one unregisters", () => {
    const keyboard = new KeyboardStore();
    const unregisterOlder = registerUndo(keyboard, "older-undo");
    registerUndo(keyboard, "newer-undo");

    unregisterOlder();

    expect(keyboard.getShortcut("newer-undo")).toBeDefined();
  });
});
