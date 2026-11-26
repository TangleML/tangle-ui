import { fireEvent, render, screen } from "@testing-library/react";
import { type ReactNode, useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  SharedStoreProvider,
  useSharedStores,
} from "@/routes/v2/shared/store/SharedStoreContext";

import { useFitViewOnResize } from "./useFitViewOnResize";

interface Pane {
  width: number;
  height: number;
}

type PaneListener = (state: Pane, previous: Pane) => void;

const fitView = vi.fn();
const paneListeners = new Set<PaneListener>();
let pane: Pane = { width: 0, height: 0 };

vi.mock("@xyflow/react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@xyflow/react")>()),
  useReactFlow: () => ({ fitView }),
  useStoreApi: () => ({
    getState: () => pane,
    subscribe: (listener: PaneListener) => {
      paneListeners.add(listener);
      return () => paneListeners.delete(listener);
    },
  }),
}));

function resizePane(next: Pane) {
  const previous = pane;
  pane = next;
  for (const listener of paneListeners) listener(next, previous);
}

type Stores = ReturnType<typeof useSharedStores>;

function Canvas({ onStores }: { onStores: (s: Stores) => void }) {
  const stores = useSharedStores();
  const containerRef = useRef<HTMLDivElement>(null);
  useFitViewOnResize(containerRef);
  onStores(stores);
  return <div ref={containerRef} data-testid="canvas" />;
}

function mountCanvas() {
  let stores: Stores | undefined;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <SharedStoreProvider>{children}</SharedStoreProvider>
  );
  const view = render(
    <Canvas
      onStores={(s) => {
        stores = s;
      }}
    />,
    { wrapper },
  );
  return { editor: stores!.editor, canvas: screen.getByTestId("canvas"), view };
}

describe("useFitViewOnResize", () => {
  beforeEach(() => {
    pane = { width: 500, height: 600 };
  });
  afterEach(() => {
    paneListeners.clear();
    vi.clearAllMocks();
  });

  it("reframes the graph when the canvas grows after its first fit", () => {
    mountCanvas();

    resizePane({ width: 800, height: 600 });

    expect(fitView).toHaveBeenCalledWith(
      expect.objectContaining({ maxZoom: 1 }),
    );
  });

  it("ignores canvas updates that leave its size alone", () => {
    mountCanvas();

    resizePane({ width: 500, height: 600 });

    expect(fitView).not.toHaveBeenCalled();
  });

  it("does not frame a canvas that has no size", () => {
    mountCanvas();

    resizePane({ width: 0, height: 600 });

    expect(fitView).not.toHaveBeenCalled();
  });

  it.each([
    ["presses", fireEvent.pointerDown],
    ["scrolls", fireEvent.wheel],
    ["types", fireEvent.keyDown],
  ])(
    "leaves the viewport alone once the user %s in the canvas",
    (_, interact) => {
      const { canvas } = mountCanvas();

      interact(canvas);
      resizePane({ width: 800, height: 600 });

      expect(fitView).not.toHaveBeenCalled();
    },
  );

  it("leaves the viewport alone once a node has been focused", () => {
    const { editor } = mountCanvas();

    editor.setPendingFocusNode("task-1");
    resizePane({ width: 800, height: 600 });

    expect(fitView).not.toHaveBeenCalled();
  });

  it("does not frame after the canvas has gone", () => {
    const { view } = mountCanvas();

    view.unmount();
    resizePane({ width: 800, height: 600 });

    expect(fitView).not.toHaveBeenCalled();
  });
});
