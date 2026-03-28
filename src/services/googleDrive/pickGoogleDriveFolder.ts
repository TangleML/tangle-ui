import type { GoogleDriveAuthService } from "./GoogleDriveAuthService";
import { loadPicker } from "./loadGoogleApis";
import type { GoogleDrivePickerResult, PickerResponseObject } from "./types";

export async function pickGoogleDriveFolder(
  auth: GoogleDriveAuthService,
): Promise<GoogleDrivePickerResult | null> {
  await loadPicker();

  const picker = window.google?.picker;
  if (!picker) {
    throw new Error("Google Picker API not available");
  }

  const apiKey = import.meta.env.VITE_GOOGLE_API_KEY as string | undefined;
  if (!apiKey) {
    throw new Error(
      "VITE_GOOGLE_API_KEY is not configured. See docs/google-drive-setup.md",
    );
  }

  const token = auth.getAccessToken();
  if (!token) {
    throw new Error("Not authenticated with Google. Request a token first.");
  }

  return new Promise<GoogleDrivePickerResult | null>((resolve) => {
    const foldersView = new picker.DocsView(picker.ViewId.FOLDERS);
    foldersView.setSelectFolderEnabled(true);

    const pickerInstance = new picker.PickerBuilder()
      .setOAuthToken(token)
      .setDeveloperKey(apiKey)
      .setTitle("Select a folder for pipeline storage")
      .addView(foldersView)
      .setCallback((data: PickerResponseObject) => {
        if (data.action === picker.Action.PICKED && data.docs?.[0]) {
          const doc = data.docs[0];
          resolve({ folderId: doc.id, folderName: doc.name });
          return;
        }
        if (data.action === picker.Action.CANCEL) {
          resolve(null);
        }
      })
      .build();

    pickerInstance.setVisible(true);
  });
}
