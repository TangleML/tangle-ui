import { describe, expect, it, vi } from "vitest";

import type { KeyboardStore } from "@/routes/v2/shared/store/keyboardStore";

import { invokeAutoLayoutVia } from "./invokeAutoLayoutVia";

function keyboardThat(
  invokeShortcut: KeyboardStore["invokeShortcut"],
): KeyboardStore {
  return { invokeShortcut } as unknown as KeyboardStore;
}

/** The canvas owns the measured node sizes dagre needs, so it does the work. */
const canvasThatLaysOut = () =>
  vi.fn((_id: string, params?: Record<string, unknown>) =>
    (params?.onLaidOut as (() => void) | undefined)?.(),
  );

describe("invokeAutoLayoutVia", () => {
  it("asks the canvas to lay itself out", () => {
    const invokeShortcut = canvasThatLaysOut();

    const laidOut = invokeAutoLayoutVia(keyboardThat(invokeShortcut))("dwyer");

    expect(laidOut).toBe(true);
    expect(invokeShortcut).toHaveBeenCalledWith(
      "auto-layout",
      expect.objectContaining({ algorithm: "dwyer" }),
    );
  });

  it("leaves the algorithm to the canvas when none was asked for", () => {
    const invokeShortcut = canvasThatLaysOut();

    invokeAutoLayoutVia(keyboardThat(invokeShortcut))();

    expect(invokeShortcut).toHaveBeenCalledWith(
      "auto-layout",
      expect.objectContaining({ algorithm: undefined }),
    );
  });

  /**
   * Nothing answers the shortcut when no canvas is mounted, and a mounted one
   * declines an empty graph. Neither may be reported as a layout that happened.
   */
  it("reports nothing laid out when the canvas does not answer", () => {
    const laidOut = invokeAutoLayoutVia(keyboardThat(vi.fn()))();

    expect(laidOut).toBe(false);
  });
});
