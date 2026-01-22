import { useSyncExternalStore } from "react";

import { ExistingBetaFlags } from "@/betaFlags";
import { getStorage } from "@/utils/typedStorage";

import type { BetaFlagsStorage } from "./types";

const storage = getStorage<keyof BetaFlagsStorage, BetaFlagsStorage>();

export function useBetaFlags() {
  return {
    getFlags: () => storage.getItem("betaFlags"),

    getFlag: (key: string, defaultValue: boolean = false) =>
      storage.getItem("betaFlags")?.[key] ?? defaultValue,

    setFlag: (key: string, value: boolean) =>
      storage.setItem("betaFlags", {
        ...storage.getItem("betaFlags"),
        [key]: value,
      }),

    removeFlag: (key: string) => {
      const flags = storage.getItem("betaFlags");
      if (flags) {
        delete flags[key];
        storage.setItem("betaFlags", flags);
      }
    },

    clear: () => {
      storage.setItem("betaFlags", undefined);
    },

    /**
     * Subscribe to changes in the local storage
     * @param listener - callback from useSyncExternalStore
     * @returns A function to unsubscribe from the storage changes
     */
    subscribe: (listener: () => void) => {
      function handleStorageChange(event: StorageEvent) {
        if (event.key === "betaFlags") {
          queueMicrotask(listener);
        }
      }
      window.addEventListener("storage", handleStorageChange);
      return () => window.removeEventListener("storage", handleStorageChange);
    },
  };
}

export function useBetaFlagValue(betaFlagName: keyof typeof ExistingBetaFlags) {
  const { getFlag, subscribe } = useBetaFlags();

  return useSyncExternalStore(subscribe, () =>
    getFlag(betaFlagName, ExistingBetaFlags[betaFlagName]?.default ?? false),
  );
}
