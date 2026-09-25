import { useSyncExternalStore } from "react";

import { ExistingFlags } from "@/flags";
import { getStorage } from "@/utils/typedStorage";

import { hasSatisfiedDependencies } from "./flagDependencies";
import type { BetaFlagsStorage } from "./types";

const storage = getStorage<keyof BetaFlagsStorage, BetaFlagsStorage>();

function storedFlagValue(flagName: string): boolean {
  return (
    storage.getItem("betaFlags")?.[flagName] ??
    ExistingFlags[flagName]?.default ??
    false
  );
}

/**
 * What a feature should ask: the stored value, and only if every flag in its
 * `dependsOn` chain is on too. Turning off a dependency therefore turns off
 * everything built on it without rewriting storage, so turning it back on
 * restores what the user had.
 *
 * `useFlagsReducer` deliberately reads {@link useFlags}.getFlag instead, so the
 * Settings switches keep showing what the user chose rather than what their
 * dependencies currently allow.
 *
 * Only knows `ExistingFlags`, not the `__TANGLE_EXTRA_FLAGS__` that
 * `SettingsFlagsProvider` merges in — an injected flag declaring `dependsOn`
 * would not resolve here. None does today.
 */
function resolveFlag(flagName: string): boolean {
  if (!storedFlagValue(flagName)) return false;

  return hasSatisfiedDependencies(flagName, (key) => {
    const flag = ExistingFlags[key];
    if (!flag) return undefined;
    return { enabled: storedFlagValue(key), dependsOn: flag.dependsOn };
  });
}

/**
 * Non-hook flag check for use outside React (e.g., route beforeLoad).
 */
export function isFlagEnabled(flagName: keyof typeof ExistingFlags): boolean {
  return resolveFlag(flagName);
}

export function useFlags() {
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

export function useFlagValue(flagName: keyof typeof ExistingFlags) {
  const { subscribe } = useFlags();

  return useSyncExternalStore(subscribe, () => resolveFlag(flagName));
}
