import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  SharedStoreProvider,
  useSharedStores,
} from "@/routes/v2/shared/store/SharedStoreContext";

import { useFitViewOnRequest } from "./useFitViewOnRequest";

const fitView = vi.fn();
let pane = { width: 800, height: 600 };

vi.mock("@xyflow/react", () => ({
  useReactFlow: () => ({ fitView }),
  useStoreApi: () => ({ getState: () => pane }),
}));

function Canvas({ onStores }: { onStores: (s: Stores) => void }) {
  const stores = useSharedStores();
  useFitViewOnRequest();
  onStores(stores);
  return null;
}

type Stores = ReturnType<typeof useSharedStores>;

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
  return { editor: stores!.editor, view };
}

const settle = () => vi.advanceTimersByTime(500);

describe("useFitViewOnRequest", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    pane = { width: 800, height: 600 };
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("frames the graph once a request has been made", () => {
    const { editor } = mountCanvas();

    editor.requestFitView();
    settle();

    expect(fitView).toHaveBeenCalledWith(
      expect.objectContaining({ maxZoom: 1 }),
    );
  });

  /** The canvas already fits on mount; refitting on top of that fights it. */
  it("leaves the canvas alone when nothing has asked", () => {
    mountCanvas();

    settle();

    expect(fitView).not.toHaveBeenCalled();
  });

  /** One tool call opens several undo groups; the canvas should not lurch per group. */
  it("frames once for a burst of requests", () => {
    const { editor } = mountCanvas();

    editor.requestFitView();
    editor.requestFitView();
    editor.requestFitView();
    settle();

    expect(fitView).toHaveBeenCalledTimes(1);
  });

  it("frames again for a request that arrives after the last one settled", () => {
    const { editor } = mountCanvas();

    editor.requestFitView();
    settle();
    editor.requestFitView();
    settle();

    expect(fitView).toHaveBeenCalledTimes(2);
  });

  /**
   * An inactive workarea tab stays mounted at no size, and fitting against
   * nothing would leave it on a viewport the user never chose.
   */
  it("does not frame a canvas that is not on screen", () => {
    const { editor } = mountCanvas();
    pane = { width: 0, height: 0 };

    editor.requestFitView();
    settle();

    expect(fitView).not.toHaveBeenCalled();
  });

  it("does not frame after the canvas has gone", () => {
    const { editor, view } = mountCanvas();

    editor.requestFitView();
    view.unmount();
    settle();

    expect(fitView).not.toHaveBeenCalled();
  });
});
