import { action, makeObservable, observable } from "mobx";
import { useEffect } from "react";

import { CMDALT } from "@/routes/v2/shared/shortcuts/keys";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";
import { VIEW_PRESETS } from "@/routes/v2/shared/windows/viewPresets";

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
 * Registers keyboard shortcuts for view presets:
 * - Cmd+Alt+/ : Toggle Minimal layout (hide all panels)
 * - Cmd+Alt+D : Default layout
 */
export function useFocusMode(): void {
  const { keyboard, windows } = useSharedStores();

  const applyPreset = (presetLabel: string) => {
    const preset = VIEW_PRESETS.find((p) => p.label === presetLabel);
    if (!preset) return;
    windows.applyViewPreset(preset);
  };

  useEffect(() => {
    const unregisterMinimal = keyboard.registerShortcut({
      id: "focus-mode",
      keys: [CMDALT, "/"],
      label: "Minimal layout",
      action: () => {
        const allHidden = windows
          .getAllWindows()
          .every((w) => w.state === "hidden");
        applyPreset(allHidden ? "Default" : "Minimal");
      },
    });

    const unregisterDefault = keyboard.registerShortcut({
      id: "default-layout",
      keys: [CMDALT, "D"],
      label: "Default layout",
      action: () => applyPreset("Default"),
    });

    return () => {
      unregisterMinimal();
      unregisterDefault();
    };
  }, [keyboard, windows]);
}
