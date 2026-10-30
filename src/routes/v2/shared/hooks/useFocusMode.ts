import { action, makeObservable, observable } from "mobx";
import { useEffect } from "react";

import { CMD_OR_CTRL, SHIFT } from "@/routes/v2/shared/shortcuts/keys";
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
 * Focus mode temporarily hides dock panels without mutating window layout
 * state.
 */
export function useFocusMode(
  defaultPreset: ViewPreset = DEFAULT_VIEW_PRESET,
): void {
  const { keyboard, windows } = useSharedStores();

  useEffect(() => {
    const unregisterFocusMode = keyboard.registerShortcut({
      id: "focus-mode",
      keys: [CMD_OR_CTRL, "/"],
      label: "Focus mode",
      action: () => focusModeStore.toggle(),
    });

    const unregisterDefault = keyboard.registerShortcut({
      id: "default-layout",
      keys: [CMD_OR_CTRL, SHIFT, "D"],
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
