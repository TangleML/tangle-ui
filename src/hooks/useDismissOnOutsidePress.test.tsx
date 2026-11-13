import { fireEvent, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useDismissOnOutsidePress } from "./useDismissOnOutsidePress";

function setup(open = true) {
  const inside = document.createElement("div");
  const outside = document.createElement("div");
  const menu = document.createElement("div");
  menu.setAttribute("role", "menu");
  document.body.append(inside, outside, menu);
  const onDismiss = vi.fn();
  renderHook(() =>
    useDismissOnOutsidePress({
      open,
      refs: [{ current: inside }],
      onDismiss,
    }),
  );
  return { inside, outside, menu, onDismiss };
}

describe("useDismissOnOutsidePress", () => {
  it("dismisses on a press outside, even one the page stops, but not inside or in a menu it opened", () => {
    const { inside, outside, menu, onDismiss } = setup();
    outside.addEventListener("pointerdown", (event) => event.stopPropagation());

    fireEvent.pointerDown(inside);
    fireEvent.pointerDown(menu);
    expect(onDismiss).not.toHaveBeenCalled();

    fireEvent.pointerDown(outside);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("dismisses when a frame takes focus, but not when another app or devtools does", () => {
    vi.useFakeTimers();
    const { onDismiss } = setup();

    fireEvent.blur(window);
    vi.runAllTimers();
    expect(onDismiss).not.toHaveBeenCalled();

    const frame = document.createElement("iframe");
    document.body.append(frame);
    frame.focus();
    fireEvent.blur(window);
    vi.runAllTimers();
    expect(onDismiss).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("does nothing while closed", () => {
    const closed = setup(false);
    fireEvent.pointerDown(closed.outside);
    expect(closed.onDismiss).not.toHaveBeenCalled();
  });
});
