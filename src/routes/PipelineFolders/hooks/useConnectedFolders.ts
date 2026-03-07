import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";

import useToastNotification from "@/hooks/useToastNotification";
import { getErrorMessage } from "@/utils/string";

import {
  addConnectedFolder,
  getConnectedFoldersInParent,
  type PermissionStatus,
  removeConnectedFolder,
  verifyPermission,
} from "../services/connectedFolderStorage";
import {
  type ConnectedFolderRecord,
  ConnectedFoldersQueryKeys,
} from "../types";

interface ConnectedFolderWithPermission extends ConnectedFolderRecord {
  permission: PermissionStatus;
}

async function verifyPermissionsAll(folders: ConnectedFolderRecord[]) {
  return Promise.all(
    folders.map(async (folder) => {
      const permission = await verifyPermission(folder.handle).catch(
        () => "denied" as const,
      );
      return { ...folder, permission } satisfies ConnectedFolderWithPermission;
    }),
  );
}

export function useConnectedFoldersInParent(parentId: string | null) {
  return useSuspenseQuery({
    queryKey: ConnectedFoldersQueryKeys.Children(parentId),
    queryFn: async () =>
      verifyPermissionsAll(await getConnectedFoldersInParent(parentId)),
  });
}

export function useAddConnectedFolder() {
  const queryClient = useQueryClient();
  const notify = useToastNotification();

  return useMutation({
    mutationFn: async () => {
      const handle = await window.showDirectoryPicker({ mode: "readwrite" });
      return addConnectedFolder(handle);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ConnectedFoldersQueryKeys.All(),
      });
      notify("Folder connected", "success");
    },
    onError: (error) => {
      if (error instanceof DOMException && error.name === "AbortError") return;
      notify("Failed to connect folder: " + getErrorMessage(error), "error");
    },
  });
}

export function useRemoveConnectedFolder() {
  const queryClient = useQueryClient();
  const notify = useToastNotification();

  return useMutation({
    mutationFn: (id: string) => removeConnectedFolder(id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ConnectedFoldersQueryKeys.All(),
      });
      notify("Folder disconnected", "success");
    },
    onError: (error) => {
      notify("Failed to disconnect folder: " + getErrorMessage(error), "error");
    },
  });
}
