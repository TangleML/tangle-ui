import type { PipelineStorageKind } from "./types";

export type StorageMode =
  { kind: "local" } | { kind: "backend"; label: string };

const BACKEND_STORAGE_LABEL = "Backend";

let resolved: StorageMode | undefined;

/**
 * A deployment says whether pipelines are stored outside the browser. Off is
 * the default and what a build with no backend of its own can do; on, they are
 * read and written through the backend the app is configured against, which
 * has to serve the pipeline routes.
 */
function backendStorageEnabled(): boolean {
  return import.meta.env.VITE_PIPELINE_STORAGE_BETA === "true";
}

/**
 * Decided once and then frozen for the life of the page: which store holds the
 * pipelines cannot change under an open editor. *Where* that backend is may
 * change — that is a setting, and the driver reads it per request.
 */
export function resolveStorageMode(): StorageMode {
  resolved ??= backendStorageEnabled()
    ? { kind: "backend", label: BACKEND_STORAGE_LABEL }
    : { kind: "local" };

  return resolved;
}

export function isBackendStorage(): boolean {
  return resolveStorageMode().kind === "backend";
}

/**
 * Which store the cached rows written on this page load describe. Storage keys
 * are only unique within one store, so a row must never be read by the other.
 */
export function currentStorageKind(): PipelineStorageKind {
  return resolveStorageMode().kind === "local" ? "local" : "backend";
}

export function resetStorageModeForTests(): void {
  resolved = undefined;
}
