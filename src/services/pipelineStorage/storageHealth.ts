import { useSyncExternalStore } from "react";

import type { HostErrorCode } from "./host/contract";
import { isHostStorage } from "./storageMode";

/**
 * Whether the store holding the pipelines is answering, learned from the calls
 * the app already makes rather than from a health check against something else.
 *
 * A host-provided store is not the execution backend: it is served by the page
 * that embeds this app, from its own endpoint and session, and stays up when
 * the configured backend is switched off. Pinging that backend to decide
 * whether pipelines can be saved reports an outage while saves are landing, and
 * says nothing when the store itself is the thing that has gone.
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

export function reportStorageFailed(code: HostErrorCode): void {
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

  return isHostStorage() && !answering;
}
