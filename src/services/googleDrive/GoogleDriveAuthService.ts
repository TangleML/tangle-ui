import { loadGis } from "./loadGoogleApis";
import type { TokenClient, TokenResponse } from "./types";

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";

export class GoogleDriveAuthService {
  private accessToken: string | null = null;
  private tokenClient: TokenClient | null = null;
  private expiresAt = 0;

  isAuthenticated(): boolean {
    return this.accessToken != null && Date.now() < this.expiresAt;
  }

  getAccessToken(): string | null {
    if (!this.isAuthenticated()) return null;
    return this.accessToken;
  }

  async requestToken(): Promise<string> {
    await loadGis();

    const google = window.google?.accounts?.oauth2;
    if (!google) {
      throw new Error("Google Identity Services not available");
    }

    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as
      | string
      | undefined;
    if (!clientId) {
      throw new Error(
        "VITE_GOOGLE_CLIENT_ID is not configured. See docs/google-drive-setup.md",
      );
    }

    return new Promise<string>((resolve, reject) => {
      this.tokenClient = google.initTokenClient({
        client_id: clientId,
        scope: DRIVE_SCOPE,
        callback: (response: TokenResponse) => {
          if (response.error) {
            this.accessToken = null;
            reject(new Error(response.error_description ?? response.error));
            return;
          }
          this.accessToken = response.access_token;
          this.expiresAt = Date.now() + response.expires_in * 1000;
          resolve(response.access_token);
        },
        error_callback: (error) => {
          reject(new Error(error.message));
        },
      });

      this.tokenClient.requestAccessToken(
        this.accessToken ? { prompt: "" } : undefined,
      );
    });
  }

  revokeToken(): void {
    if (!this.accessToken) return;
    window.google?.accounts?.oauth2.revoke(this.accessToken);
    this.accessToken = null;
    this.expiresAt = 0;
  }
}

let instance: GoogleDriveAuthService | null = null;

export function getGoogleDriveAuth(): GoogleDriveAuthService {
  if (!instance) instance = new GoogleDriveAuthService();
  return instance;
}
