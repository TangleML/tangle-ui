export interface RemoteTroubleshootActionConfig {
  endpointUrl: string;
  buttonText: string;
  modalTitle?: string;
  modalDescription?: string;
  successTitle?: string;
  successMessage?: string;
  source?: string;
}

declare global {
  interface Window {
    __TANGLE_REMOTE_TROUBLESHOOT_ACTION__?: RemoteTroubleshootActionConfig;
  }
}
