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
 * Resolving the `dependsOn` chain at read time rather than rewriting storage is
 * what lets turning a dependency back on restore what the user had. The
 * Settings switches deliberately read {@link useFlags}.getFlag instead, so they
 * keep showing what the user chose rather than what dependencies now allow.
 *
 * Only knows `ExistingFlags`, so a `__TANGLE_EXTRA_FLAGS__` flag declaring
 * `dependsOn` would not resolve here. None does today.
 */
function resolveFlag(flagName: string): boolean {
  if (!storedFlagValue(flagName)) return false;

  return hasSatisfiedDependencies(flagName, (key) => {
    const flag = ExistingFlags[key];
    if (!flag) return undefined;
    return { enabled: storedFlagValue(key), dependsOn: flag.dependsOn };
  });
}

/** For callers outside React, such as a route's `beforeLoad`. */
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
