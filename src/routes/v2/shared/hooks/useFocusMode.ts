import { action, makeObservable, observable } from "mobx";
import { useEffect } from "react";

import { CMDALT } from "@/routes/v2/shared/shortcuts/keys";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";
import { VIEW_PRESETS } from "@/routes/v2/shared/windows/viewPresets";
import type { WindowStoreImpl } from "@/routes/v2/shared/windows/windowStore";

class FocusModeStore {
  @observable accessor active = false;
  private previousVisibleIds: string[] = [];

  constructor() {
    makeObservable(this);
  }

  /** Snapshot which windows are currently visible, then enter minimal. */
  @action enterMinimal(windows: WindowStoreImpl): void {
    this.previousVisibleIds = windows
      .getAllWindows()
      .filter((w) => w.state !== "hidden")
      .map((w) => w.id);
    this.active = true;
  }

  /** Restore the windows that were visible before entering minimal. */
  @action exitMinimal(windows: WindowStoreImpl): void {
    for (const id of this.previousVisibleIds) {
      windows.restoreWindow(id);
    }
    this.previousVisibleIds = [];
    this.active = false;
  }

  @action reset(): void {
    this.active = false;
    this.previousVisibleIds = [];
  }
}

export const focusModeStore = new FocusModeStore();

/**
 * Registers keyboard shortcuts for view presets:
 * - Cmd+Alt+1 : Default layout
 * - Cmd+Alt+2 : Toggle Minimal layout (restores previous state on exit)
 * - Cmd+Alt+3 : All windows
 */
export function useFocusMode(): void {
  const { keyboard, windows } = useSharedStores();

  const applyPreset = (presetLabel: string) => {
    const preset = VIEW_PRESETS.find((p) => p.label === presetLabel);
    if (!preset) return;
    windows.applyViewPreset(preset);
  };

  useEffect(() => {
    const unregisterDefault = keyboard.registerShortcut({
      id: "layout-default",
      keys: [CMDALT, "1"],
      label: "Default layout",
      action: () => {
        applyPreset("Default");
        focusModeStore.reset();
      },
    });

    const unregisterMinimal = keyboard.registerShortcut({
      id: "layout-minimal",
      keys: [CMDALT, "2"],
      label: "Minimal layout",
      action: () => {
        if (focusModeStore.active) {
          focusModeStore.exitMinimal(windows);
        } else {
          focusModeStore.enterMinimal(windows);
          applyPreset("Minimal");
        }
      },
    });

    const unregisterAll = keyboard.registerShortcut({
      id: "layout-all",
      keys: [CMDALT, "3"],
      label: "All windows",
      action: () => {
        applyPreset("All");
        focusModeStore.reset();
      },
    });

    return () => {
      unregisterDefault();
      unregisterMinimal();
      unregisterAll();
    };
  }, [keyboard, windows]);
}
