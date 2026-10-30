import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  CMD_OR_CTRL,
  CTRL,
  type KeyConstant,
} from "@/routes/v2/shared/shortcuts/keys";
import { KeyboardStore } from "@/routes/v2/shared/store/keyboardStore";

import { useShortcutListener } from "./useShortcutListener";

const shared = vi.hoisted(() => ({ keyboard: {} as KeyboardStore }));

vi.mock("@/routes/v2/shared/store/SharedStoreContext", () => ({
  useSharedStores: () => shared,
}));

function listen({ isMac }: { isMac: boolean }) {
  shared.keyboard = new KeyboardStore({ isMac });
  renderHook(() => useShortcutListener());
}

function register(keys: KeyConstant[], action: () => void | false = vi.fn()) {
  shared.keyboard.registerShortcut({
    id: keys.join("+"),
    keys,
    label: "Test shortcut",
    action,
  });
  return action;
}

function keyDown(init: KeyboardEventInit) {
  const event = new KeyboardEvent("keydown", { cancelable: true, ...init });
  window.dispatchEvent(event);
  return event;
}

describe("useShortcutListener", () => {
  afterEach(() => {
    cleanup();
  });

  it("takes over the keystroke when the shortcut handles it", () => {
    listen({ isMac: false });
    register([CMD_OR_CTRL, "C"], () => undefined);

    expect(keyDown({ key: "c", ctrlKey: true }).defaultPrevented).toBe(true);
  });

  it("leaves the keystroke to the browser when the shortcut returns false", () => {
    listen({ isMac: false });
    register([CMD_OR_CTRL, "C"], () => false);

    expect(keyDown({ key: "c", ctrlKey: true }).defaultPrevented).toBe(false);
  });

  describe("off Mac", () => {
    it("runs primary-modifier shortcuts with Ctrl", () => {
      listen({ isMac: false });
      const undo = register([CMD_OR_CTRL, "Z"]);

      keyDown({ key: "z", ctrlKey: true });

      expect(undo).toHaveBeenCalledTimes(1);
    });

    it("does not treat Alt as the primary modifier", () => {
      listen({ isMac: false });
      const undo = register([CMD_OR_CTRL, "Z"]);

      keyDown({ key: "z", altKey: true });

      expect(undo).not.toHaveBeenCalled();
    });

    it("runs Ctrl shortcuts with the same Ctrl key", () => {
      listen({ isMac: false });
      const openPipeline = register([CTRL, "O"]);

      keyDown({ key: "o", ctrlKey: true });

      expect(openPipeline).toHaveBeenCalledTimes(1);
    });

    it("ignores auto-repeat while Ctrl is held", () => {
      listen({ isMac: false });
      const undo = register([CMD_OR_CTRL, "Z"]);

      keyDown({ key: "z", ctrlKey: true, repeat: true });

      expect(undo).not.toHaveBeenCalled();
    });

    it("stops treating the primary modifier as held once Ctrl is released", () => {
      listen({ isMac: false });

      keyDown({ key: "Control", ctrlKey: true });
      expect(shared.keyboard.pressed.has(CMD_OR_CTRL)).toBe(true);

      window.dispatchEvent(new KeyboardEvent("keyup", { key: "Control" }));
      expect(shared.keyboard.pressed.has(CMD_OR_CTRL)).toBe(false);
    });
  });

  describe("on Mac", () => {
    it("runs primary-modifier shortcuts with Cmd", () => {
      listen({ isMac: true });
      const undo = register([CMD_OR_CTRL, "Z"]);

      keyDown({ key: "z", metaKey: true });

      expect(undo).toHaveBeenCalledTimes(1);
    });

    it("keeps Ctrl separate from Cmd", () => {
      listen({ isMac: true });
      const undo = register([CMD_OR_CTRL, "Z"]);
      const openPipeline = register([CTRL, "O"]);

      keyDown({ key: "z", ctrlKey: true });
      window.dispatchEvent(
        new KeyboardEvent("keyup", { key: "z", ctrlKey: true }),
      );
      keyDown({ key: "o", ctrlKey: true });

      expect(undo).not.toHaveBeenCalled();
      expect(openPipeline).toHaveBeenCalledTimes(1);
    });
  });
});
