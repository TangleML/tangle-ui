import { BackendNotConnected } from "@/components/shared/BackendNotConnected";

export function SecretsBackendUnavailable() {
  return (
    <BackendNotConnected
      description="Secrets are stored on your Tangle backend. Connect one in Settings to manage secrets."
      data-testid="secrets-backend-unavailable"
    />
  );
}
