import { useMutation, useQueryClient } from "@tanstack/react-query";

import useToastNotification from "@/hooks/useToastNotification";
import { usePipelineStorage } from "@/services/pipelineStorage/PipelineStorageProvider";
import { getErrorMessage } from "@/utils/string";

import { FoldersQueryKeys } from "../pipelineStorage/types";
import { getGoogleDriveAuth } from "./GoogleDriveAuthService";
import { pickGoogleDriveFolder } from "./pickGoogleDriveFolder";

export function useConnectGoogleDriveFolder() {
  const queryClient = useQueryClient();
  const notify = useToastNotification();
  const storage = usePipelineStorage();

  return useMutation({
    mutationFn: async () => {
      const auth = getGoogleDriveAuth();
      await auth.requestToken();

      const result = await pickGoogleDriveFolder(auth);
      if (!result) return null;

      return storage.rootFolder.createSubfolder({
        name: result.folderName,
        driverConfig: {
          driverType: "google-drive",
          folderId: result.folderId,
        },
      });
    },
    onSuccess: (folder) => {
      if (!folder) return;
      queryClient.invalidateQueries({ queryKey: FoldersQueryKeys.All() });
      notify("Google Drive folder connected", "success");
    },
    onError: (error) => {
      notify(
        "Failed to connect Google Drive: " + getErrorMessage(error),
        "error",
      );
    },
  });
}
