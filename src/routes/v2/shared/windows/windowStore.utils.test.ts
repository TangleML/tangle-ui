import { describe, expect, it } from "vitest";

import {
  type Position,
  type Size,
  WINDOW_CHROME_HEIGHT,
  type WindowOptions,
} from "./types";
import type { ViewportBounds } from "./viewportUtils";
import { DEFAULT_VIEW_PRESET } from "./viewPresets";
import type { PersistedWindowLayout } from "./windowPersistence";
import { buildWindowModelInit } from "./windowStore.utils";

// Mirrors CURRENT_VERSION in windowPersistence.ts. If the schema version is
// bumped there, these fixtures must be updated — loadWindowLayout migrates or
// discards older versions, so a stale fixture stops exercising what it claims.
const LAYOUT_VERSION = 5;

const DEFAULT_POSITION: Position = { x: 100, y: 100 };
const DEFAULT_SIZE: Size = { width: 320, height: 420 };

interface SeedWindowState {
  isHidden?: boolean;
  isMinimized?: boolean;
  dockState?: "left" | "right" | "none";
  position?: Position;
  size?: Size;
}

function persistedWindow(
  id: string,
  state: SeedWindowState,
): PersistedWindowLayout {
  return {
    windows: {
      [id]: {
        position: state.position ?? DEFAULT_POSITION,
        size: state.size ?? DEFAULT_SIZE,
        dockState: state.dockState ?? "none",
        isHidden: state.isHidden ?? false,
        isMinimized: state.isMinimized ?? false,
      },
    },
    windowOrder: [id],
    dockAreas: {
      left: { width: 320, collapsed: false, windowOrder: [] },
      right: { width: 320, collapsed: false, windowOrder: [] },
    },
    version: LAYOUT_VERSION,
  };
}

function baseOptions(overrides: Partial<WindowOptions> = {}): WindowOptions {
  return { title: "Test Window", persisted: true, ...overrides };
}

describe("resolveInitialState (via buildWindowModelInit)", () => {
  it("honors persisted hidden state even when startVisible is set", () => {
    const id = "persisted-hidden-window";
    const layout = persistedWindow(id, { isHidden: true });

    const init = buildWindowModelInit(
      id,
      baseOptions({ startVisible: true }),
      DEFAULT_POSITION,
      undefined,
      layout,
    );

    expect(init.state).toBe("hidden");
  });

  it("starts visible on first visit when startVisible is set", () => {
    const id = "first-visit-start-visible";

    const init = buildWindowModelInit(
      id,
      baseOptions({ startVisible: true }),
      DEFAULT_POSITION,
    );

    expect(init.state).toBe("normal");
  });

  it("starts hidden on first visit for a window absent from the default preset without startVisible", () => {
    const id = "window-not-in-default-preset";
    expect(DEFAULT_VIEW_PRESET.visible.has(id)).toBe(false);

    const init = buildWindowModelInit(id, baseOptions(), DEFAULT_POSITION);

    expect(init.state).toBe("hidden");
  });

  it("restores a persisted minimized docked window as minimized", () => {
    const id = "persisted-minimized-docked";
    const layout = persistedWindow(id, {
      isMinimized: true,
      dockState: "left",
    });

    const init = buildWindowModelInit(
      id,
      baseOptions(),
      DEFAULT_POSITION,
      undefined,
      layout,
    );

    expect(init.state).toBe("minimized");
  });
});

describe("resolveGeometry viewport clamping (via buildWindowModelInit)", () => {
  const VIEWPORT_BOUNDS: ViewportBounds = {
    left: 0,
    top: 56,
    right: 1000,
    bottom: 800,
  };

  it("brings an off-viewport persisted floating window back into view", () => {
    const id = "off-screen-floating";
    const layout = persistedWindow(id, {
      dockState: "none",
      position: { x: 5000, y: 5000 },
      size: { width: 320, height: 420 },
    });

    const init = buildWindowModelInit(
      id,
      baseOptions(),
      DEFAULT_POSITION,
      VIEWPORT_BOUNDS,
      layout,
    );

    expect(init.position).toEqual({
      x: VIEWPORT_BOUNDS.right - 320,
      y: VIEWPORT_BOUNDS.bottom - 420 - WINDOW_CHROME_HEIGHT,
    });
  });

  it("leaves an in-viewport persisted floating window untouched", () => {
    const id = "in-view-floating";
    const position: Position = { x: 120, y: 140 };
    const layout = persistedWindow(id, {
      dockState: "none",
      position,
      size: { width: 320, height: 420 },
    });

    const init = buildWindowModelInit(
      id,
      baseOptions(),
      DEFAULT_POSITION,
      VIEWPORT_BOUNDS,
      layout,
    );

    expect(init.position).toEqual(position);
  });

  it("does not clamp the position of a persisted docked window", () => {
    const id = "off-screen-docked";
    const position: Position = { x: 5000, y: 5000 };
    const layout = persistedWindow(id, {
      dockState: "left",
      position,
      size: { width: 320, height: 420 },
    });

    const init = buildWindowModelInit(
      id,
      baseOptions(),
      DEFAULT_POSITION,
      VIEWPORT_BOUNDS,
      layout,
    );

    expect(init.position).toEqual(position);
  });

  it("does not clamp a first-visit default position (no persisted state)", () => {
    const id = "first-visit-default";
    const optionPosition: Position = { x: 5000, y: 5000 };

    const init = buildWindowModelInit(
      id,
      baseOptions({ position: optionPosition, startVisible: true }),
      DEFAULT_POSITION,
      VIEWPORT_BOUNDS,
    );

    expect(init.position).toEqual(optionPosition);
  });
});

describe("minDockedHeight (via buildWindowModelInit)", () => {
  it("passes the option through to the model init", () => {
    const init = buildWindowModelInit(
      "logs-window",
      baseOptions({ minDockedHeight: 280 }),
      DEFAULT_POSITION,
    );

    expect(init.minDockedHeight).toBe(280);
  });

  it("leaves the value unset when the option is omitted", () => {
    const init = buildWindowModelInit(
      "plain-window",
      baseOptions(),
      DEFAULT_POSITION,
    );

    expect(init.minDockedHeight).toBeUndefined();
  });
});
