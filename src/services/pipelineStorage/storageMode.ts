import type { PipelineStorageHost } from "./host/contract";
import { getPipelineStorageHost } from "./host/detectHost";

export type StorageMode =
  | { kind: "local" }
  | { kind: "host"; label: string }
  | { kind: "host-missing" };

let resolved: StorageMode | undefined;
let resolvedHost: PipelineStorageHost | undefined;

/**
 * A deployment says which store it runs on; it is not guessed from whether a
 * host happens to have loaded. `host` without one is an error rather than a
 * quiet fall back to browser storage, which would strand a user's work
 * somewhere nobody else can see it.
 *
 * Unset keeps the old behaviour — a host if one is there, browser storage
 * otherwise — because that is what a build nobody configured wants, and the
 * open-source build never has a host to find.
 */
function configuredStorage(): "host" | "local" | "detect" {
  const configured = import.meta.env.VITE_PIPELINE_STORAGE;
  return configured === "host" || configured === "local"
    ? configured
    : "detect";
}

/**
 * Decided once and then frozen for the life of the page, holding on to the host
 * itself rather than re-reading the global — a host whose global is removed or
 * whose getter starts throwing must not read as "no host" and quietly send the
 * next write to browser storage.
 */
export function resolveStorageMode(): StorageMode {
  if (resolved) return resolved;

  const configured = configuredStorage();

  if (configured === "local") {
    resolvedHost = undefined;
    resolved = { kind: "local" };
    return resolved;
  }

  resolvedHost = getPipelineStorageHost();

  if (resolvedHost) {
    resolved = { kind: "host", label: resolvedHost.label };
  } else {
    resolved =
      configured === "host" ? { kind: "host-missing" } : { kind: "local" };
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
