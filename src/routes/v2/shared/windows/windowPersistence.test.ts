import { act, cleanup, renderHook } from "@testing-library/react";
import { createElement, type PropsWithChildren } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  SharedStoreProvider,
  useSharedStores,
} from "@/routes/v2/shared/store/SharedStoreContext";

import {
  clearLayout,
  loadWindowLayout,
  migrateLayout,
  TOUR_WINDOW_LAYOUT_ID,
  useWindowPersistence,
} from "./windowPersistence";
import { WindowStoreImpl } from "./windowStore";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  localStorage.clear();
});

it("isolates saved layout keys, debounced writes, and cleanup across mounted views", () => {
  vi.useFakeTimers();
  localStorage.setItem(
    "window-layout-first",
    JSON.stringify(
      createLayout(5, {
        details: createWindowState({ isHidden: true }),
      }),
    ),
  );
  localStorage.setItem(
    "window-layout-second",
    JSON.stringify(
      createLayout(5, {
        details: createWindowState({ isHidden: false }),
      }),
    ),
  );

  const wrapper = ({ children }: PropsWithChildren) =>
    createElement(SharedStoreProvider, null, children);
  function usePersistedStore(layoutId: string) {
    useWindowPersistence(layoutId);
    return useSharedStores().windows;
  }
  const first = renderHook(() => usePersistedStore("first"), { wrapper });
  const second = renderHook(() => usePersistedStore("second"), { wrapper });
  const embedded = new WindowStoreImpl();
  const options = {
    id: "details",
    title: "Details",
    persisted: true,
    defaultVisible: true,
  };

  act(() => {
    first.result.current.openWindow(null, options);
    second.result.current.openWindow(null, options);
    embedded.openWindow(null, options);
  });
  expect(first.result.current.getWindowById("details")?.state).toBe("hidden");
  expect(second.result.current.getWindowById("details")?.state).toBe("normal");
  expect(embedded.getWindowById("details")?.state).toBe("normal");
  expect(embedded.getWindowById("details")?.dockState).toBe("none");

  act(() => {
    first.result.current
      .getWindowById("details")!
      .updatePosition({ x: 111, y: 100 });
    second.result.current
      .getWindowById("details")!
      .updatePosition({ x: 222, y: 100 });
    vi.advanceTimersByTime(500);
  });
  expect(loadWindowLayout("first")?.windows.details.position.x).toBe(111);
  expect(loadWindowLayout("second")?.windows.details.position.x).toBe(222);

  act(() => {
    first.result.current
      .getWindowById("details")!
      .updatePosition({ x: 333, y: 100 });
    second.unmount();
    vi.advanceTimersByTime(500);
  });
  expect(loadWindowLayout("first")?.windows.details.position.x).toBe(333);
  expect(loadWindowLayout("second")?.windows.details.position.x).toBe(222);
});

describe("clearLayout", () => {
  it("removes only the targeted layout key", () => {
    localStorage.setItem("window-layout-editor", '{"editor":true}');
    localStorage.setItem("window-layout-tour", '{"tour":true}');

    clearLayout(TOUR_WINDOW_LAYOUT_ID);

    expect(localStorage.getItem("window-layout-tour")).toBeNull();
    expect(localStorage.getItem("window-layout-editor")).toBe(
      '{"editor":true}',
    );
  });

  it("is a no-op when the layout key is absent", () => {
    expect(() => clearLayout(TOUR_WINDOW_LAYOUT_ID)).not.toThrow();
    expect(localStorage.getItem("window-layout-tour")).toBeNull();
  });

  it("keeps the tour layout id distinct from the editor's", () => {
    expect(TOUR_WINDOW_LAYOUT_ID).not.toBe("editor");
  });
});

const createWindowState = (overrides = {}) => ({
  position: { x: 1472, y: 103 },
  size: { width: 280, height: 350 },
  dockState: "right" as const,
  isHidden: false,
  isMinimized: false,
  ...overrides,
});

const createLayout = (
  version: number,
  windows: Record<string, ReturnType<typeof createWindowState>>,
) => ({
  windows,
  windowOrder: Object.keys(windows),
  dockAreas: {
    left: { width: 320, collapsed: false, windowOrder: [] },
    right: { width: 320, collapsed: false, windowOrder: Object.keys(windows) },
  },
  version,
});

describe("migrateLayout", () => {
  it("drops the stamped dockedHeight from every window in a version 4 layout", () => {
    const layout = createLayout(4, {
      "pipeline-details": createWindowState({ dockedHeight: 300 }),
      history: createWindowState({ dockedHeight: 300 }),
    });

    const migrated = migrateLayout(layout);

    expect(migrated?.version).toBe(5);
    expect(migrated?.windows["pipeline-details"]).not.toHaveProperty(
      "dockedHeight",
    );
    expect(migrated?.windows.history).not.toHaveProperty("dockedHeight");
  });

  it("keeps a dockedHeight the user chose", () => {
    const layout = createLayout(4, {
      "pipeline-details": createWindowState({ dockedHeight: 300 }),
      history: createWindowState({ dockedHeight: 512.5 }),
    });

    const migrated = migrateLayout(layout);

    expect(migrated?.windows["pipeline-details"]).not.toHaveProperty(
      "dockedHeight",
    );
    expect(migrated?.windows.history.dockedHeight).toBe(512.5);
  });

  it("preserves every other window field while migrating", () => {
    const layout = createLayout(4, {
      "pipeline-details": createWindowState({
        dockedHeight: 300,
        isMinimized: true,
        preDockedSize: { width: 280, height: 350 },
      }),
    });

    const migrated = migrateLayout(layout);

    expect(migrated?.windows["pipeline-details"]).toEqual({
      position: { x: 1472, y: 103 },
      size: { width: 280, height: 350 },
      dockState: "right",
      isHidden: false,
      isMinimized: true,
      preDockedSize: { width: 280, height: 350 },
    });
    expect(migrated?.dockAreas).toEqual(layout.dockAreas);
    expect(migrated?.windowOrder).toEqual(layout.windowOrder);
  });

  it("returns a current-version layout untouched", () => {
    const layout = createLayout(5, {
      "pipeline-details": createWindowState({ dockedHeight: 250 }),
    });

    expect(migrateLayout(layout)).toBe(layout);
  });

  it("discards layouts older than version 4", () => {
    const layout = createLayout(3, {
      "pipeline-details": createWindowState(),
    });

    expect(migrateLayout(layout)).toBeNull();
  });
});
