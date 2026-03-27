import { useMutation, useQueryClient } from "@tanstack/react-query";

import useToastNotification from "@/hooks/useToastNotification";
import { usePipelineStorage } from "@/services/pipelineStorage/PipelineStorageProvider";
import { getErrorMessage } from "@/utils/string";

import { FoldersQueryKeys } from "../types";

export function useCreateFolder() {
  const queryClient = useQueryClient();
  const notify = useToastNotification();
  const storage = usePipelineStorage();

  return useMutation({
    mutationFn: async ({
      name,
      parentId,
    }: {
      name: string;
      parentId: string | null;
    }) => {
      const parent =
        parentId === null
          ? storage.rootFolder
          : await storage.findFolderById(parentId);
      return parent.createSubfolder({ name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FoldersQueryKeys.All() });
      notify("Folder created", "success");
    },
    onError: (error) => {
      notify("Failed to create folder: " + getErrorMessage(error), "error");
    },
  });
}

export function useRenameFolder() {
  const queryClient = useQueryClient();
  const notify = useToastNotification();
  const storage = usePipelineStorage();

  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const folder = await storage.findFolderById(id);
      return folder.renameFolder(name);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FoldersQueryKeys.All() });
      notify("Folder renamed", "success");
    },
    onError: (error) => {
      notify("Failed to rename folder: " + getErrorMessage(error), "error");
    },
  });
}

export function useDeleteFolder() {
  const queryClient = useQueryClient();
  const notify = useToastNotification();
  const storage = usePipelineStorage();

  return useMutation({
    mutationFn: async (id: string) => {
      const folder = await storage.findFolderById(id);
      return folder.deleteFolder();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FoldersQueryKeys.All() });
      notify("Folder deleted", "success");
    },
    onError: (error) => {
      notify("Failed to delete folder: " + getErrorMessage(error), "error");
    },
  });
}

export function useToggleFavorite() {
  const queryClient = useQueryClient();
  const notify = useToastNotification();
  const storage = usePipelineStorage();

  return useMutation({
    mutationFn: async (id: string) => {
      const folder = await storage.findFolderById(id);
      return folder.toggleFavorite();
    },
    onSuccess: (isFavorite) => {
      queryClient.invalidateQueries({ queryKey: FoldersQueryKeys.All() });
      notify(
        isFavorite ? "Added to favorites" : "Removed from favorites",
        "success",
      );
    },
    onError: (error) => {
      notify("Failed to update favorite: " + getErrorMessage(error), "error");
    },
  });
}

export function useConnectFolder() {
  const queryClient = useQueryClient();
  const notify = useToastNotification();
  const storage = usePipelineStorage();

  return useMutation({
    mutationFn: async () => {
      const handle = await window.showDirectoryPicker({ mode: "readwrite" });

      const existing = await storage.rootFolder.listSubfolders();
      for (const folder of existing) {
        if (folder.driver.type !== "local-fs") continue;
        const config = folder.driver as {
          dirHandle?: FileSystemDirectoryHandle;
        };
        if ("dirHandle" in config) {
          // Cannot easily compare handles here; rely on name dedup
        }
      }

      return storage.rootFolder.createSubfolder({
        name: handle.name,
        driverConfig: { driverType: "local-fs", handle },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FoldersQueryKeys.All() });
      notify("Folder connected", "success");
    },
    onError: (error) => {
      if (error instanceof DOMException && error.name === "AbortError") return;
      notify("Failed to connect folder: " + getErrorMessage(error), "error");
    },
  });
}

export function useDisconnectFolder() {
  const queryClient = useQueryClient();
  const notify = useToastNotification();
  const storage = usePipelineStorage();

  return useMutation({
    mutationFn: async (id: string) => {
      const folder = await storage.findFolderById(id);
      return folder.deleteFolder();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FoldersQueryKeys.All() });
      notify("Folder disconnected", "success");
    },
    onError: (error) => {
      notify("Failed to disconnect folder: " + getErrorMessage(error), "error");
    },
  });
}
