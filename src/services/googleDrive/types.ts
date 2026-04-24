// --- Driver config (persisted to IndexedDB) ---

export interface GoogleDriveDriverConfig {
  driverType: "google-drive";
  folderId: string;
}

// --- Picker result ---

export interface GoogleDrivePickerResult {
  folderId: string;
  folderName: string;
}

// --- Google Identity Services (GIS) types ---

export interface TokenResponse {
  access_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
  error?: string;
  error_description?: string;
}

export interface TokenClient {
  requestAccessToken(overrides?: { prompt?: string }): void;
}

interface TokenClientConfig {
  client_id: string;
  scope: string;
  callback: (response: TokenResponse) => void;
  error_callback?: (error: { type: string; message: string }) => void;
}

interface GoogleAccountsOAuth2 {
  initTokenClient(config: TokenClientConfig): TokenClient;
  revoke(token: string, callback?: () => void): void;
}

// --- Google Picker types ---

interface PickerDocument {
  id: string;
  name: string;
  mimeType: string;
}

export interface PickerResponseObject {
  action: string;
  docs?: PickerDocument[];
}

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2: GoogleAccountsOAuth2;
      };
      picker?: {
        PickerBuilder: new () => GooglePickerBuilder;
        DocsView: new (viewId: string) => GooglePickerDocsView;
        ViewId: { FOLDERS: string };
        Action: { PICKED: string; CANCEL: string };
      };
    };
    gapi?: {
      load(api: string, callback: () => void): void;
    };
  }
}

interface GooglePickerBuilder {
  setOAuthToken(token: string): GooglePickerBuilder;
  setDeveloperKey(key: string): GooglePickerBuilder;
  setCallback(
    callback: (data: PickerResponseObject) => void,
  ): GooglePickerBuilder;
  addView(view: GooglePickerDocsView): GooglePickerBuilder;
  setTitle(title: string): GooglePickerBuilder;
  build(): { setVisible(visible: boolean): void };
}

interface GooglePickerDocsView {
  setSelectFolderEnabled(enabled: boolean): GooglePickerDocsView;
  setMimeTypes(mimeTypes: string): GooglePickerDocsView;
}
