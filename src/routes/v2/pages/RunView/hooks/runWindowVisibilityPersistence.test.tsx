import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  RUN_AI_ASSISTANT_WINDOW_ID,
  RUN_DETAILS_WINDOW_ID,
  RUN_TOOLS_WINDOW_ID,
} from "@/routes/v2/pages/RunView/runViewWindowPresets";
import { WindowStoreImpl } from "@/routes/v2/shared/windows/windowStore";

import { useAiChatWindow } from "./useAiChatWindow";
import { useRunViewWindows } from "./useRunViewWindows";

const persistenceMocks = vi.hoisted(() => ({
  getPersistedWindowState: vi.fn(),
  hasPersistedLayout: vi.fn(),
}));

vi.mock("@/routes/v2/shared/windows/windowPersistence", () => ({
  getPersistedWindowState: persistenceMocks.getPersistedWindowState,
  hasPersistedLayout: persistenceMocks.hasPersistedLayout,
}));

let windows: WindowStoreImpl;

vi.mock("@/routes/v2/shared/store/SharedStoreContext", () => ({
  useSharedStores: () => ({ windows }),
}));

vi.mock("@/routes/v2/pages/RunView/components/RunDetailsContent", () => ({
  RunDetailsContent: () => null,
}));
vi.mock("@/routes/v2/pages/RunView/components/RunToolsContent", () => ({
  RunToolsContent: () => null,
}));
vi.mock("@/routes/v2/shared/components/AiChat/AiChatContent", () => ({
  AiChatContent: () => null,
}));
vi.mock("@/routes/v2/pages/RunView/toolBridge/runViewToolBridge", () => ({
  createRunViewToolBridge: vi.fn(),
}));

const RUN_WINDOW_IDS = [
  RUN_TOOLS_WINDOW_ID,
  RUN_DETAILS_WINDOW_ID,
  RUN_AI_ASSISTANT_WINDOW_ID,
];

function renderRunWindowHooks() {
  return renderHook(() => {
    useRunViewWindows();
    useAiChatWindow(true);
  });
}

describe("Run View window visibility persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    windows = new WindowStoreImpl();
  });

  afterEach(cleanup);

  it("shows the default Run View windows when no layout is persisted", () => {
    persistenceMocks.getPersistedWindowState.mockReturnValue(null);
    persistenceMocks.hasPersistedLayout.mockReturnValue(false);

    renderRunWindowHooks();

    for (const id of RUN_WINDOW_IDS) {
      expect(windows.getWindowById(id)?.state).toBe("normal");
    }
  });

  it("honors default visibility when an existing layout has no state for a window", () => {
    persistenceMocks.getPersistedWindowState.mockReturnValue(null);
    persistenceMocks.hasPersistedLayout.mockReturnValue(true);

    windows.openWindow(null, {
      id: "new-hidden-window",
      title: "New Hidden Window",
      defaultVisible: false,
      persisted: true,
    });

    expect(windows.getWindowById("new-hidden-window")?.state).toBe("hidden");
  });

  it("restores hidden Run View windows from the persisted layout", () => {
    persistenceMocks.getPersistedWindowState.mockReturnValue({
      position: { x: 0, y: 0 },
      size: { width: 320, height: 420 },
      dockState: "left",
      isHidden: true,
      isMinimized: false,
    });
    persistenceMocks.hasPersistedLayout.mockReturnValue(true);

    renderRunWindowHooks();

    for (const id of RUN_WINDOW_IDS) {
      expect(windows.getWindowById(id)?.state).toBe("hidden");
    }
  });
});
