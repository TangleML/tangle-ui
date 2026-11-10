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

  it("dismisses when focus leaves the page for a frame, and only while open", () => {
    const open = setup();
    fireEvent.blur(window);
    expect(open.onDismiss).toHaveBeenCalledTimes(1);

    const closed = setup(false);
    fireEvent.pointerDown(closed.outside);
    expect(closed.onDismiss).not.toHaveBeenCalled();
  });
});
