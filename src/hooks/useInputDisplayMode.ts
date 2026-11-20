import { useSyncExternalStore } from "react";

import type { BetaFlagsStorage } from "@/components/shared/Settings/types";
import { getStorage } from "@/utils/typedStorage";

export type InputDisplayMode = "separate" | "clustered" | "embedded";

const INPUT_DISPLAY_MODE_STORAGE_KEY = "App/inputDisplayMode";
const LEGACY_CLUSTERING_FLAG = "input-node-clustering";

const modeStorage = getStorage<
  typeof INPUT_DISPLAY_MODE_STORAGE_KEY,
  Record<typeof INPUT_DISPLAY_MODE_STORAGE_KEY, InputDisplayMode>
>();

const legacyFlagStorage = getStorage<
  keyof BetaFlagsStorage,
  BetaFlagsStorage
>();

function isInputDisplayMode(value: unknown): value is InputDisplayMode {
  return value === "separate" || value === "clustered" || value === "embedded";
}

/**
 * Resolves the persisted input display mode, falling back to a one-time
 * migration from the legacy `input-node-clustering` beta flag so existing
 * users who enabled clustering keep that behavior.
 */
function readInputDisplayMode(): InputDisplayMode {
  const stored = modeStorage.getItem(INPUT_DISPLAY_MODE_STORAGE_KEY);
  if (isInputDisplayMode(stored)) {
    return stored;
  }

  const legacyClustering =
    legacyFlagStorage.getItem("betaFlags")?.[LEGACY_CLUSTERING_FLAG];
  return legacyClustering ? "clustered" : "separate";
}

export function setInputDisplayMode(mode: InputDisplayMode): void {
  modeStorage.setItem(INPUT_DISPLAY_MODE_STORAGE_KEY, mode);
}

function subscribe(listener: () => void): () => void {
  function handleStorageChange(event: StorageEvent) {
    if (event.key === INPUT_DISPLAY_MODE_STORAGE_KEY) {
      queueMicrotask(listener);
    }
  }
  window.addEventListener("storage", handleStorageChange);
  return () => window.removeEventListener("storage", handleStorageChange);
}

export function useInputDisplayMode(): InputDisplayMode {
  return useSyncExternalStore(subscribe, readInputDisplayMode);
}
