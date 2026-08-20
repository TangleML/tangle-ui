import { useSyncExternalStore } from "react";

import { DEFAULT_TANGENT_BASE_URL } from "@/routes/v2/shared/tangent/constants";
import { getStorage } from "@/utils/typedStorage";
import { isRecord } from "@/utils/typeGuards";

/**
 * Runtime Tangent connection settings owned by the user.
 *
 * The base URL used to be baked in at build time via `VITE_TANGENT_BASE_URL`.
 * It now lives in localStorage so a user can point tangle-ui at any Tangent
 * origin without rebuilding.
 */
export const TANGENT_STORAGE_KEY = "tangle.tangent.config";

type StorageKey = typeof TANGENT_STORAGE_KEY;
type TangentSettingsStorage = Record<StorageKey, unknown>;

const storage = getStorage<StorageKey, TangentSettingsStorage>();

interface TangentSettings {
  baseUrl: string;
}

function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

function readStoredBaseUrl(): string {
  if (typeof window === "undefined") return DEFAULT_TANGENT_BASE_URL;
  const stored = storage.getItem(TANGENT_STORAGE_KEY);
  if (!isRecord(stored)) return DEFAULT_TANGENT_BASE_URL;
  const { baseUrl } = stored;
  if (typeof baseUrl !== "string") return DEFAULT_TANGENT_BASE_URL;
  const normalized = normalizeBaseUrl(baseUrl);
  return normalized.length > 0 ? normalized : DEFAULT_TANGENT_BASE_URL;
}

function subscribe(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (event: StorageEvent) => {
    if (event.key === TANGENT_STORAGE_KEY || event.key === null) {
      callback();
    }
  };
  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}

function getSnapshot(): string {
  return readStoredBaseUrl();
}

function getServerSnapshot(): string {
  return DEFAULT_TANGENT_BASE_URL;
}

export function useTangentSettings() {
  const baseUrl = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const update = (partial: Partial<TangentSettings>) => {
    if (typeof window === "undefined") return;
    const next: TangentSettings = {
      baseUrl: readStoredBaseUrl(),
      ...partial,
    };
    storage.setItem(TANGENT_STORAGE_KEY, {
      baseUrl: normalizeBaseUrl(next.baseUrl),
    });
  };

  const reset = () => {
    if (typeof window === "undefined") return;
    storage.setItem(TANGENT_STORAGE_KEY, null);
  };

  return { baseUrl, update, reset };
}
