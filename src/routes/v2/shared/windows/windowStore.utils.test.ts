import { afterEach, describe, expect, it } from "vitest";

import type { Position, Size, WindowOptions } from "./types";
import { DEFAULT_VIEW_PRESET } from "./viewPresets";
import { buildWindowModelInit } from "./windowStore.utils";

// Mirrors CURRENT_VERSION in windowPersistence.ts. If the schema version is
// bumped there, these fixtures must be updated (and loadWindowLayout would
// otherwise discard them, causing these tests to fail loudly).
const LAYOUT_VERSION = 4;

// Default storage key used when no active layout id is set (see getStorageKey).
const STORAGE_KEY = "editorV2-window-layout";

const DEFAULT_POSITION: Position = { x: 100, y: 100 };
const DEFAULT_SIZE: Size = { width: 320, height: 420 };

interface SeedWindowState {
  isHidden?: boolean;
  isMinimized?: boolean;
  dockState?: "left" | "right" | "none";
}

function seedPersistedWindow(id: string, state: SeedWindowState): void {
  const layout = {
    windows: {
      [id]: {
        position: DEFAULT_POSITION,
        size: DEFAULT_SIZE,
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
  localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
}

function baseOptions(overrides: Partial<WindowOptions> = {}): WindowOptions {
  return { title: "Test Window", persisted: true, ...overrides };
}

afterEach(() => {
  localStorage.clear();
});

describe("resolveInitialState (via buildWindowModelInit)", () => {
  it("honors persisted hidden state even when startVisible is set", () => {
    const id = "persisted-hidden-window";
    seedPersistedWindow(id, { isHidden: true });

    const init = buildWindowModelInit(
      id,
      baseOptions({ startVisible: true }),
      DEFAULT_POSITION,
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
    seedPersistedWindow(id, { isMinimized: true, dockState: "left" });

    const init = buildWindowModelInit(id, baseOptions(), DEFAULT_POSITION);

    expect(init.state).toBe("minimized");
  });
});
