import type { StorageErrorCode } from "./types";

/**
 * Whether the backend holding the pipelines is answering, learned from the
 * calls the app already makes. An error is only an outage if the backend failed
 * to answer at all: "no such pipeline" is an answer.
 *
 * Kept free of React and of the provider that knows the backend's address, so
 * that the driver reporting into it does not drag either into its own module
 * graph. `useStorageUnavailable` is the way to read it.
 */
let answering = true;

const listeners = new Set<() => void>();

function set(next: boolean): void {
  if (answering === next) return;
  answering = next;
  for (const listener of listeners) listener();
}

export function reportStorageAnswered(): void {
  set(true);
}

export function reportStorageFailed(code: StorageErrorCode): void {
  set(code !== "unavailable");
}

export function subscribeStorageHealth(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function isStorageAnswering(): boolean {
  return answering;
}
