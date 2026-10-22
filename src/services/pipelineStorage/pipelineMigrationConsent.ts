import { normalizeBackendUrl } from "@/utils/backendIdentity";

const consentPrefix = "local-pipeline-migration-consent-v1:";

export function pipelineMigrationConsentKey(backendUrl: string): string {
  return `${consentPrefix}${normalizeBackendUrl(backendUrl)}`;
}

export function hasPipelineMigrationConsent(backendUrl: string): boolean {
  try {
    return Object.keys(localStorage).some(
      (key) =>
        key.startsWith(consentPrefix) &&
        normalizeBackendUrl(key.slice(consentPrefix.length)) ===
          normalizeBackendUrl(backendUrl) &&
        localStorage.getItem(key) === "true",
    );
  } catch {
    return false;
  }
}

export function subscribePipelineMigrationConsent(
  listener: () => void,
): () => void {
  window.addEventListener("storage", listener);
  return () => window.removeEventListener("storage", listener);
}

export function revokePipelineMigrationConsent(backendUrl: string): void {
  const key = pipelineMigrationConsentKey(backendUrl);
  for (const storedKey of Object.keys(localStorage)) {
    if (
      storedKey.startsWith(consentPrefix) &&
      normalizeBackendUrl(storedKey.slice(consentPrefix.length)) ===
        normalizeBackendUrl(backendUrl)
    )
      localStorage.removeItem(storedKey);
  }
  window.dispatchEvent(new StorageEvent("storage", { key }));
}
