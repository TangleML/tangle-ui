import { action, makeObservable, observable } from "mobx";
import { useEffect } from "react";

import { CMDALT } from "@/routes/v2/shared/shortcuts/keys";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";
import {
  DEFAULT_VIEW_PRESET,
  type ViewPreset,
} from "@/routes/v2/shared/windows/viewPresets";

class FocusModeStore {
  @observable accessor active = false;

  constructor() {
    makeObservable(this);
  }

  @action setActive(value: boolean): void {
    this.active = value;
  }

  @action toggle(): void {
    this.active = !this.active;
  }

  @action reset(): void {
    this.active = false;
  }
}

export const focusModeStore = new FocusModeStore();

/**
 * Registers keyboard shortcuts:
 * - Cmd+Alt+/ : Toggle Focus mode (temporarily hide dock panels without
 *               mutating window layout state)
 * - Cmd+Alt+D : Default layout (apply the Default view preset)
 */
export function useFocusMode(
  defaultPreset: ViewPreset = DEFAULT_VIEW_PRESET,
): void {
  const { keyboard, windows } = useSharedStores();

  useEffect(() => {
    const unregisterFocusMode = keyboard.registerShortcut({
      id: "focus-mode",
      keys: [CMDALT, "/"],
      label: "Focus mode",
      action: () => focusModeStore.toggle(),
    });

    const unregisterDefault = keyboard.registerShortcut({
      id: "default-layout",
      keys: [CMDALT, "D"],
      label: "Default layout",
      action: () => {
        windows.applyViewPreset(defaultPreset);
      },
    });

    return () => {
      unregisterFocusMode();
      unregisterDefault();
    };
  }, [keyboard, windows, defaultPreset]);
}
