import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { VerticalResizeHandle } from "./resize-handle";

afterEach(cleanup);

interface ResizeCase {
  name: string;
  side: "left" | "right";
  startWidth: number;
  minWidth: number;
  maxWidth: number;
  startX: number;
  endX: number;
  attemptedWidth: number;
  renderedWidth: number;
}

const resizeCases: ResizeCase[] = [
  {
    name: "left dock past its collapsed threshold",
    side: "right",
    startWidth: 320,
    minWidth: 220,
    maxWidth: 600,
    startX: 300,
    endX: 100,
    attemptedWidth: 120,
    renderedWidth: 220,
  },
  {
    name: "right dock past its collapsed threshold",
    side: "left",
    startWidth: 320,
    minWidth: 220,
    maxWidth: 600,
    startX: 100,
    endX: 300,
    attemptedWidth: 120,
    renderedWidth: 220,
  },
  {
    name: "left mini dock toward its expanded state",
    side: "right",
    startWidth: 36,
    minWidth: 36,
    maxWidth: 36,
    startX: 100,
    endX: 300,
    attemptedWidth: 236,
    renderedWidth: 36,
  },
  {
    name: "right mini dock toward its expanded state",
    side: "left",
    startWidth: 36,
    minWidth: 36,
    maxWidth: 36,
    startX: 300,
    endX: 100,
    attemptedWidth: 236,
    renderedWidth: 36,
  },
];

describe("VerticalResizeHandle", () => {
  it.each(resizeCases)("reports resize progress for $name", (resizeCase) => {
    const onResize = vi.fn();
    const onResizeEnd = vi.fn();
    const { container } = render(
      <div>
        <VerticalResizeHandle
          side={resizeCase.side}
          minWidth={resizeCase.minWidth}
          maxWidth={resizeCase.maxWidth}
          onResize={onResize}
          onResizeEnd={onResizeEnd}
        />
      </div>,
    );
    const handle = container.querySelector<HTMLElement>(".cursor-col-resize");
    const parent = handle?.parentElement;
    if (!handle || !parent) throw new Error("Missing resize handle");
    Object.defineProperty(parent, "offsetWidth", {
      value: resizeCase.startWidth,
    });

    fireEvent.mouseDown(handle, { clientX: resizeCase.startX });
    fireEvent.mouseMove(document, { clientX: resizeCase.endX });

    expect(parent).toHaveStyle({ width: `${resizeCase.renderedWidth}px` });
    expect(onResize).toHaveBeenCalledWith(resizeCase.attemptedWidth);

    fireEvent.mouseUp(document);

    expect(onResizeEnd).toHaveBeenCalledWith(resizeCase.attemptedWidth);
  });
});
