import { useQuery } from "@tanstack/react-query";

import {
  getConnectedFolderById,
  type LocalPipelineFile,
  type PermissionStatus,
  scanForPipelineFiles,
  verifyPermission,
} from "../services/connectedFolderStorage";
import { ConnectedFoldersQueryKeys } from "../types";

export interface ConnectedFolderPipelinesResult {
  isConnectedFolder: true;
  files: LocalPipelineFile[];
  permission: PermissionStatus;
  handle: FileSystemDirectoryHandle;
  isLoading: boolean;
  rescan: () => void;
}

export interface NotConnectedResult {
  isConnectedFolder: false;
}

export type UseConnectedFolderPipelinesResult =
  | ConnectedFolderPipelinesResult
  | NotConnectedResult;

/**
 * Given a folderId, checks if it's a connected folder. If so, scans for
 * pipeline files and returns them. Returns `{ isConnectedFolder: false }`
 * for regular folders.
 */
export function useConnectedFolderPipelines(
  folderId: string | null,
): UseConnectedFolderPipelinesResult {
  const lookupQuery = useQuery({
    queryKey: [...ConnectedFoldersQueryKeys.All(), "lookup", folderId],
    queryFn: () => (folderId ? getConnectedFolderById(folderId) : undefined),
    enabled: folderId !== null,
  });

  const connectedFolder = lookupQuery.data;

  const filesQuery = useQuery<{
    files: LocalPipelineFile[];
    permission: PermissionStatus;
  }>({
    queryKey: ConnectedFoldersQueryKeys.Files(folderId ?? ""),
    queryFn: async () => {
      if (!connectedFolder) return { files: [], permission: "denied" };

      const permission = await verifyPermission(connectedFolder.handle);
      if (permission !== "granted") {
        return { files: [], permission };
      }

      const files = await scanForPipelineFiles(connectedFolder.handle);
      return { files, permission };
    },
    enabled: connectedFolder !== undefined,
  });

  const rescan = () => {
    if (folderId) {
      filesQuery.refetch();
    }
  };

  if (!folderId || !connectedFolder) {
    return { isConnectedFolder: false };
  }

  return {
    isConnectedFolder: true,
    files: filesQuery.data?.files ?? [],
    permission: filesQuery.data?.permission ?? "prompt",
    handle: connectedFolder.handle,
    isLoading: lookupQuery.isLoading || filesQuery.isLoading,
    rescan,
  };
}
