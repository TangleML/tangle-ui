import type { PipelineStorageHost } from "./host/contract";
import { getPipelineStorageHost } from "./host/detectHost";

export type StorageMode = { kind: "local" } | { kind: "host"; label: string };

let resolved: StorageMode | undefined;
let resolvedHost: PipelineStorageHost | undefined;

/**
 * Decided once and then frozen for the life of the page, holding on to the host
 * itself rather than re-reading the global. Detection is fail-open, so a host
 * whose global is removed or whose getter starts throwing would otherwise read
 * as "no host" and quietly send the next write to browser storage — the one
 * outcome host mode exists to prevent.
 */
export function resolveStorageMode(): StorageMode {
  if (!resolved) {
    resolvedHost = getPipelineStorageHost();
    resolved = resolvedHost
      ? { kind: "host", label: resolvedHost.label }
      : { kind: "local" };
  }

  return resolved;
}

export function getStorageHost(): PipelineStorageHost | undefined {
  resolveStorageMode();
  return resolvedHost;
}

export function isHostStorage(): boolean {
  return resolveStorageMode().kind === "host";
}

export function resetStorageModeForTests(): void {
  resolved = undefined;
  resolvedHost = undefined;
}
