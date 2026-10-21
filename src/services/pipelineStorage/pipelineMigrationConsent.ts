export function pipelineMigrationConsentKey(backendUrl: string): string {
  return `local-pipeline-migration-consent-v1:${backendUrl}`;
}

export function hasPipelineMigrationConsent(backendUrl: string): boolean {
  try {
    return (
      localStorage.getItem(pipelineMigrationConsentKey(backendUrl)) === "true"
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
  localStorage.removeItem(key);
  window.dispatchEvent(new StorageEvent("storage", { key }));
}
