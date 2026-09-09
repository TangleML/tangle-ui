import { useSyncExternalStore } from "react";

import { isBackendStorage } from "./storageMode";
import type { StorageErrorCode } from "./types";

/**
 * Whether the store holding the pipelines is answering, learned from the calls
 * the app already makes rather than from a health check against something else.
 *
 * The configured backend serves more than pipelines, and a health check
 * against it says nothing about whether the pipeline routes are answering —
 * which is the only thing the pipeline list and the save indicator are about.
 *
 * An error is only an outage if the store failed to answer at all. "No such
 * pipeline" is an answer.
 */
let reachable = true;

const listeners = new Set<() => void>();

function set(next: boolean): void {
  if (reachable === next) return;
  reachable = next;
  for (const listener of listeners) listener();
}

export function reportStorageAnswered(): void {
  set(true);
}

export function reportStorageFailed(code: StorageErrorCode): void {
  if (code !== "unavailable") {
    set(true);
    return;
  }

  set(false);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useStorageUnavailable(): boolean {
  const answering = useSyncExternalStore(
    subscribe,
    () => reachable,
    () => true,
  );

  return isBackendStorage() && !answering;
}
