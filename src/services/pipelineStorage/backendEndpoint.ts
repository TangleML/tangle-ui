import { API_URL } from "@/utils/constants";

/**
 * Where the backend is, for the parts of pipeline storage that are not React
 * and cannot ask the provider. `BackendProvider` owns the setting — env,
 * relative path, or one the user typed — and publishes it here whenever it
 * changes, so there is still one place that decides it.
 *
 * Until it does, the environment's own answer stands: a provider publishes
 * from an effect, and effects run child-first, so the first read of the
 * pipeline list can happen before the provider above it has said anything.
 */
let published: string | undefined;

export function setBackendEndpoint(url: string): void {
  published = url.trim();
}

export function getBackendEndpoint(): string {
  return published ?? API_URL ?? window.location.origin;
}
