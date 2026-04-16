import { useReactFlow } from "@xyflow/react";
import { action, makeObservable, observable } from "mobx";
import { useEffect } from "react";

import { CMDALT } from "@/routes/v2/shared/shortcuts/keys";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

class FocusModeStore {
  @observable accessor active = false;

  constructor() {
    makeObservable(this);
  }

  @action toggle(): void {
    this.active = !this.active;
  }

  @action reset(): void {
    this.active = false;
  }
}

export const focusModeStore = new FocusModeStore();

export function toggleFocusMode(): void {
  focusModeStore.toggle();
}

/**
 * Registers the Cmd+/ keyboard shortcut for focus mode.
 * Focus mode hides dock areas via CSS without mutating window store state.
 * Call once at the EditorV2 root level.
 */
export function useFocusMode(): void {
  const { fitView } = useReactFlow();
  const { keyboard } = useSharedStores();

  useEffect(() => {
    const unregisterShortcut = keyboard.registerShortcut({
      id: "focus-mode",
      keys: [CMDALT, "/"],
      label: "Focus mode",
      action: () => toggleFocusMode(),
    });

    return () => {
      unregisterShortcut();
      focusModeStore.reset();
    };
  }, [fitView, keyboard]);
}
