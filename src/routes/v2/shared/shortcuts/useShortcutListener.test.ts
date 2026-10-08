import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CMDALT } from "@/routes/v2/shared/shortcuts/keys";
import { KeyboardStore } from "@/routes/v2/shared/store/keyboardStore";

import { useShortcutListener } from "./useShortcutListener";

const keyboard = new KeyboardStore();

vi.mock("@/routes/v2/shared/store/SharedStoreContext", () => ({
  useSharedStores: () => ({ keyboard }),
}));

function copyWith(action: () => void | false) {
  const unregister = keyboard.registerShortcut({
    id: "copy",
    keys: [CMDALT, "C"],
    label: "Copy",
    action,
  });
  const { unmount } = renderHook(() => useShortcutListener());

  const event = new KeyboardEvent("keydown", {
    key: "c",
    metaKey: true,
    cancelable: true,
  });
  window.dispatchEvent(event);

  unmount();
  unregister();
  return event;
}

describe("useShortcutListener", () => {
  it("takes over the keystroke when the shortcut handles it", () => {
    expect(copyWith(() => undefined).defaultPrevented).toBe(true);
  });

  it("leaves the keystroke to the browser when the shortcut returns false", () => {
    expect(copyWith(() => false).defaultPrevented).toBe(false);
  });
});
