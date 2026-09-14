import { cleanup, fireEvent, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { KeyboardStore } from "@/routes/v2/shared/store/keyboardStore";

import { CMDALT, CTRL, ESCAPE, SHIFT } from "./keys";
import { useShortcutListener } from "./useShortcutListener";

let keyboard: KeyboardStore;

vi.mock("@/routes/v2/shared/store/SharedStoreContext", () => ({
  useSharedStores: () => ({ keyboard }),
}));

const onError = vi.fn((event: ErrorEvent) => event.preventDefault());

describe("useShortcutListener", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    keyboard = new KeyboardStore();
    window.addEventListener("error", onError);
    renderHook(() => useShortcutListener());
  });

  afterEach(() => {
    cleanup();
    window.removeEventListener("error", onError);
  });

  describe.each(["keydown", "keyup"])("%s", (type) => {
    it.each([undefined, null, 65])(
      "ignores events with key=%s without changing shortcut state",
      (key) => {
        const event = new Event(type, { cancelable: true });
        if (key !== undefined) {
          Object.defineProperty(event, "key", { value: key });
        }

        keyboard.pressKey(CMDALT);
        keyboard.pressKey("K");
        const action = vi.fn();
        keyboard.registerShortcut({
          id: "test",
          keys: ["K"],
          label: "Test shortcut",
          action,
        });

        fireEvent(window, event);

        expect(onError).not.toHaveBeenCalled();
        expect(keyboard.pressedKeys).toEqual([CMDALT, "K"]);
        expect(action).not.toHaveBeenCalled();
        expect(event.defaultPrevented).toBe(false);

        fireEvent.keyUp(window, { key: "Meta" });
        expect(keyboard.pressedKeys).toEqual([]);

        fireEvent.keyDown(window, { key: "k" });
        expect(action).toHaveBeenCalledTimes(1);
        expect(keyboard.pressedKeys).toEqual([]);
        expect(onError).not.toHaveBeenCalled();
      },
    );
  });

  it.each([
    { key: "a", expected: "A" },
    { key: "Meta", metaKey: true, expected: CMDALT },
    { key: "Alt", altKey: true, expected: CMDALT },
    { key: "Control", ctrlKey: true, expected: CTRL },
    { key: "Shift", shiftKey: true, expected: SHIFT },
    { key: "Escape", expected: ESCAPE },
  ])("tracks and releases $key", ({ expected, ...init }) => {
    fireEvent.keyDown(window, init);
    expect(keyboard.pressedKeys).toEqual([expected]);

    fireEvent.keyUp(window, { key: init.key });
    expect(keyboard.pressedKeys).toEqual([]);
    expect(onError).not.toHaveBeenCalled();
  });

  it("dispatches a valid shortcut and clears pressed keys", () => {
    const action = vi.fn();
    keyboard.registerShortcut({
      id: "test",
      keys: [CMDALT, "K"],
      label: "Test shortcut",
      action,
    });
    const event = new KeyboardEvent("keydown", {
      key: "k",
      metaKey: true,
      cancelable: true,
    });

    fireEvent(window, event);

    expect(action).toHaveBeenCalledExactlyOnceWith(event);
    expect(keyboard.pressedKeys).toEqual([]);
    expect(event.defaultPrevented).toBe(true);
    expect(onError).not.toHaveBeenCalled();
  });
});
