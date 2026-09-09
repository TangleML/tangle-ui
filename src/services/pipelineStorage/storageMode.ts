import type { PipelineStorageHost } from "./host/contract";
import { getPipelineStorageHost } from "./host/detectHost";

export type StorageMode =
  | { kind: "local" }
  | { kind: "host"; label: string }
  | { kind: "host-missing" };

let resolved: StorageMode | undefined;
let resolvedHost: PipelineStorageHost | undefined;

/**
 * A deployment says whether it stores pipelines outside the browser; it is not
 * guessed from whether a host happens to have loaded. Off is the default and
 * the only thing the open-source build can be. On without a host is an error
 * rather than a quiet fall back to browser storage, which would strand a user's
 * work somewhere nobody else can see it.
 */
function hostStorageEnabled(): boolean {
  return import.meta.env.VITE_PIPELINE_STORAGE_BETA === "true";
}

/**
 * Decided once and then frozen for the life of the page, holding on to the host
 * itself rather than re-reading the global — a host whose global is removed or
 * whose getter starts throwing must not read as "no host" and quietly send the
 * next write to browser storage.
 */
export function resolveStorageMode(): StorageMode {
  if (resolved) return resolved;

  if (!hostStorageEnabled()) {
    resolvedHost = undefined;
    resolved = { kind: "local" };
    return resolved;
  }

  resolvedHost = getPipelineStorageHost();
  resolved = resolvedHost
    ? { kind: "host", label: resolvedHost.label }
    : { kind: "host-missing" };

  return resolved;
}

export function getStorageHost(): PipelineStorageHost | undefined {
  resolveStorageMode();
  return resolvedHost;
}

export function isHostStorage(): boolean {
  return resolveStorageMode().kind === "host";
}

/**
 * The deployment requires a host-provided store and the page did not supply
 * one. Nothing can be read or written, so this is worth saying rather than
 * rendering an empty library.
 */
export function isHostStorageMissing(): boolean {
  return resolveStorageMode().kind === "host-missing";
}

export function resetStorageModeForTests(): void {
  resolved = undefined;
  resolvedHost = undefined;
}
